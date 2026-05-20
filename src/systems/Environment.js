/*
 * Environment - per-run biome picker. Each environment defines:
 *   - a tiling background texture
 *   - a list of obstacle types to scatter, with weights and clearance rules
 *   - a soft tint applied to the camera for atmosphere
 *
 * Obstacles are placed deterministically-but-randomly around the spawn point
 * with a "no-spawn-bubble" so the player isn't immediately hemmed in. Each
 * obstacle gets a static physics body sized to its visual base (trunk, etc.)
 * so the leafy crowns can overlap the player visually without blocking them.
 *
 * The texture metadata baseY / bodyW / bodyH is read off the source canvas
 * by the painter (set in PixelArt.js).
 */

const ENVIRONMENTS = {
    forest: {
        name: 'Eldwood Forest',
        bgTexture: 'grass',
        ambientTint: 0xc8e6c0,
        ambientTintStrength: 0.15,
        obstacles: [
            { texture: 'tree', count: 220, clearance: 60, minSpacing: 36 },
            { texture: 'dead_tree', count: 40, clearance: 60, minSpacing: 40 },
            { texture: 'rock', count: 60, clearance: 50, minSpacing: 30 }
        ]
    },
    swamp: {
        name: 'Murkmire Swamp',
        bgTexture: 'swamp_mud',
        ambientTint: 0x90b890,
        ambientTintStrength: 0.18,
        obstacles: [
            { texture: 'dead_tree', count: 130, clearance: 60, minSpacing: 38 },
            { texture: 'tree', count: 30, clearance: 60, minSpacing: 42 },
            { texture: 'rock', count: 110, clearance: 50, minSpacing: 28 }
        ]
    },
    library: {
        name: 'Castle Library',
        bgTexture: 'wood_floor',
        ambientTint: 0xffd9a0,
        ambientTintStrength: 0.12,
        obstacles: [
            /* Beefed up bookshelf coverage and added writing desks so
             * the library feels like an actual library - rows of
             * shelving punctuated by desks where someone (used to)
             * study. The desk has a wider footprint than a candelabra
             * so it gets more spacing to avoid overlap. */
            { texture: 'bookshelf', count: 160, clearance: 64, minSpacing: 44 },
            { texture: 'desk',      count: 70,  clearance: 60, minSpacing: 50 },
            { texture: 'candelabra', count: 70, clearance: 50, minSpacing: 32 },
            { texture: 'crate',      count: 90, clearance: 50, minSpacing: 30 }
        ]
    },
    /*
     * Three new biomes added for content variety. Each one re-uses the
     * existing obstacle textures with a fresh ambient tint + bg pairing,
     * so we get distinct atmosphere without spending a sprite-art budget
     * on net-new tiles. The Particles weather layer reads the biome
     * key from GameScene to pick rain (swamp), embers (library, volcano),
     * snow (ice cavern), or none (forest, cathedral).
     */
    cathedral: {
        name: 'Forsaken Cathedral',
        bgTexture: 'cobble',
        ambientTint: 0x9aa0e8,
        ambientTintStrength: 0.22,
        obstacles: [
            { texture: 'candelabra', count: 180, clearance: 70, minSpacing: 38 },
            { texture: 'rock',       count: 100, clearance: 50, minSpacing: 30 },
            { texture: 'crate',      count: 60,  clearance: 50, minSpacing: 30 },
            { texture: 'desk',       count: 30,  clearance: 60, minSpacing: 50 }
        ]
    },
    ice_cavern: {
        name: 'Frozen Vaults',
        bgTexture: 'cobble',
        ambientTint: 0xb5e8ff,
        ambientTintStrength: 0.30,
        obstacles: [
            { texture: 'rock',       count: 220, clearance: 50, minSpacing: 28 },
            { texture: 'dead_tree',  count: 60,  clearance: 60, minSpacing: 42 },
            { texture: 'crate',      count: 30,  clearance: 50, minSpacing: 30 }
        ]
    },
    volcano: {
        name: 'Embermount Caldera',
        bgTexture: 'swamp_mud',
        ambientTint: 0xff9a6b,
        ambientTintStrength: 0.30,
        obstacles: [
            { texture: 'rock',       count: 240, clearance: 60, minSpacing: 28 },
            { texture: 'dead_tree',  count: 80,  clearance: 60, minSpacing: 40 },
            { texture: 'candelabra', count: 30,  clearance: 50, minSpacing: 32 }
        ]
    }
};

export const ENVIRONMENT_KEYS = Object.keys(ENVIRONMENTS);

export function pickEnvironment(forced) {
    if (forced && ENVIRONMENTS[forced]) return { key: forced, ...ENVIRONMENTS[forced] };
    const i = Math.floor(Math.random() * ENVIRONMENT_KEYS.length);
    const key = ENVIRONMENT_KEYS[i];
    return { key, ...ENVIRONMENTS[key] };
}

/*
 * Scatter obstacles around the origin in an area of `range` x `range` pixels.
 * Returns a list of placement records: { texture, x, y, baseY, bodyW, bodyH }.
 * Uses a coarse spatial grid to enforce minimum spacing and avoid spawn point.
 */
export function scatterObstacles(scene, env, range = 4000) {
    const placed = [];
    const cellSize = 24;
    const grid = new Map();
    const cellKey = (cx, cy) => `${cx}|${cy}`;
    const queryNeighbors = (x, y, radius) => {
        const cellsR = Math.ceil(radius / cellSize) + 1;
        const cx = Math.floor(x / cellSize);
        const cy = Math.floor(y / cellSize);
        const out = [];
        for (let dy = -cellsR; dy <= cellsR; dy++) {
            for (let dx = -cellsR; dx <= cellsR; dx++) {
                const list = grid.get(cellKey(cx + dx, cy + dy));
                if (list) out.push(...list);
            }
        }
        return out;
    };
    const insertCell = (rec) => {
        const cx = Math.floor(rec.x / cellSize);
        const cy = Math.floor(rec.y / cellSize);
        const k = cellKey(cx, cy);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(rec);
    };

    for (const ob of env.obstacles) {
        let attempts = 0;
        let placedCount = 0;
        const maxAttempts = ob.count * 10;
        while (placedCount < ob.count && attempts < maxAttempts) {
            attempts++;
            const x = (Math.random() - 0.5) * range;
            const y = (Math.random() - 0.5) * range;
            if (Math.hypot(x, y) < ob.clearance) continue;

            const tex = scene.textures.get(ob.texture);
            const src = tex.getSourceImage();
            const baseY = src.baseY ?? src.height;
            const bodyW = src.bodyW ?? Math.max(8, src.width - 4);
            const bodyH = src.bodyH ?? 6;

            const tooClose = queryNeighbors(x, y, ob.minSpacing).some(other => {
                return Math.hypot(other.x - x, other.y - y) < ob.minSpacing;
            });
            if (tooClose) continue;

            const rec = {
                texture: ob.texture,
                x,
                y,
                width: src.width,
                height: src.height,
                baseY,
                bodyW,
                bodyH
            };
            placed.push(rec);
            insertCell(rec);
            placedCount++;
        }
    }

    return placed;
}
