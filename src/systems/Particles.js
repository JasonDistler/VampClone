/*
 * Lightweight, allocation-friendly particle system.
 *
 * Why custom instead of Phaser's built-in particle emitter?
 *   - We're spawning lots of tiny single-pixel-style shards per hit / death
 *     that just need (x, y, vx, vy, life, color, size). Phaser's emitter
 *     is great for textured plumes but is overkill for "rectangle moves
 *     for 250ms then disappears".
 *   - Particle visuals here are pure colored rectangles drawn straight
 *     to a Phaser Graphics object, which keeps them on the GPU as a
 *     single batched draw call no matter how many particles are alive.
 *
 * Usage:
 *   scene.particles = new ParticleSystem(scene);
 *   scene.particles.update(time, dt);
 *   scene.particles.spawnDust(x, y);
 *   scene.particles.spawnBlood(x, y, dirX, dirY);
 *   scene.particles.spawnGemPop(x, y);
 *   scene.particles.spawnDeathShards(x, y, tint);
 *   scene.particles.spawnLevelUpBurst(x, y);
 *   scene.particles.spawnBossSpawnCrack(x, y);
 *
 * The system is also used by the weather layer (continuous rain / snow
 * / embers). Those are emitted from spawnWeather() once per frame at
 * the camera's edge so they always stream past the visible area.
 */

const MAX_PARTICLES = 800;

/* Pool slot fields. We keep these as a plain typed-ish object array
 * rather than parallel TypedArrays - simpler, and at MAX_PARTICLES the
 * GC hit is negligible. */
function makeSlot() {
    return {
        active: false,
        x: 0, y: 0,
        vx: 0, vy: 0,
        ax: 0, ay: 0,
        life: 0, maxLife: 0,
        size: 1,
        color: 0xffffff,
        alpha: 1,
        gravity: 0,
        drag: 0,
        scrollFactor: 1,
        depth: 0,
        glow: false,
        squareFade: false
    };
}

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.pool = [];
        for (let i = 0; i < MAX_PARTICLES; i++) this.pool.push(makeSlot());
        this.cursor = 0;

        // Single Graphics object for normal-blend particles
        this.gfx = scene.add.graphics();
        this.gfx.setDepth(9000);

        // Separate Graphics for ADD-blend (glowing) particles so they
        // pop without bleeding into normal sprites
        this.gfxAdd = scene.add.graphics();
        this.gfxAdd.setBlendMode(Phaser.BlendModes.ADD);
        this.gfxAdd.setDepth(9001);

        // Weather layer - screen-locked, drawn behind gameplay sprites
        // so e.g. raindrops don't appear in front of the player's chest.
        this.gfxWeather = scene.add.graphics();
        this.gfxWeather.setScrollFactor(0);
        this.gfxWeather.setDepth(-100);

        this.weatherType = null;     // 'rain' | 'snow' | 'embers' | null
        this._weatherAccumulator = 0;
    }

    _alloc() {
        // Round-robin allocator: grab next slot, scan up to MAX once
        // for the next inactive one. If everything is in flight we
        // overwrite the oldest active slot - acceptable for "particle
        // overflow rare" cases.
        for (let i = 0; i < MAX_PARTICLES; i++) {
            this.cursor = (this.cursor + 1) % MAX_PARTICLES;
            const s = this.pool[this.cursor];
            if (!s.active) return s;
        }
        return this.pool[this.cursor];
    }

    _spawn(opts) {
        const s = this._alloc();
        s.active = true;
        s.x = opts.x;
        s.y = opts.y;
        s.vx = opts.vx || 0;
        s.vy = opts.vy || 0;
        s.ax = opts.ax || 0;
        s.ay = opts.ay || 0;
        s.gravity = opts.gravity || 0;
        s.drag = opts.drag || 0;
        s.life = opts.life;
        s.maxLife = opts.life;
        s.size = opts.size || 1;
        s.color = opts.color || 0xffffff;
        s.alpha = opts.alpha ?? 1;
        s.scrollFactor = opts.scrollFactor ?? 1;
        s.depth = opts.depth ?? 0;
        s.glow = opts.glow || false;
        s.squareFade = opts.squareFade || false;
        return s;
    }

    /* -----------------------------------------------------------------
     * SFX-style one-shot bursts
     * ----------------------------------------------------------------- */

    /*
     * A small puff of footstep dust. Two or three short-lived
     * earth-toned squares that float upward briefly. Called by the
     * Player when actually moving, throttled to once per ~140ms so
     * we don't carpet the world with dust.
     */
    spawnDust(x, y) {
        const COLORS = [0x8a7858, 0x6a5840, 0xa89070];
        for (let i = 0; i < 3; i++) {
            this._spawn({
                x: x + (Math.random() - 0.5) * 4,
                y: y + (Math.random() * 1.5),
                vx: (Math.random() - 0.5) * 18,
                vy: -8 - Math.random() * 14,
                gravity: 30,
                drag: 0.92,
                life: 280 + Math.random() * 120,
                size: 1,
                color: COLORS[i % COLORS.length],
                alpha: 0.6
            });
        }
    }

    /*
     * Blood / ichor spray on enemy hit. Direction-aware: pixels fly
     * roughly along the strike vector with a small spread.
     */
    spawnBlood(x, y, dirX = 0, dirY = 0, tint = 0x8a1818) {
        const len = Math.hypot(dirX, dirY) || 1;
        const nx = dirX / len;
        const ny = dirY / len;
        for (let i = 0; i < 5; i++) {
            const spread = (Math.random() - 0.5) * 0.9;
            const speed = 90 + Math.random() * 70;
            const cs = Math.cos(spread), sn = Math.sin(spread);
            const fx = nx * cs - ny * sn;
            const fy = nx * sn + ny * cs;
            this._spawn({
                x, y,
                vx: fx * speed,
                vy: fy * speed - 20,
                gravity: 240,
                drag: 0.88,
                life: 220 + Math.random() * 140,
                size: 1,
                color: tint,
                alpha: 0.95
            });
        }
    }

    /*
     * Confetti-style burst when the player picks up an XP gem. Bright
     * colored pixels that radiate out and fade quickly.
     */
    spawnGemPop(x, y, color = 0x9bd6ff) {
        for (let i = 0; i < 6; i++) {
            const ang = Math.random() * Math.PI * 2;
            const speed = 60 + Math.random() * 50;
            this._spawn({
                x, y,
                vx: Math.cos(ang) * speed,
                vy: Math.sin(ang) * speed,
                gravity: 100,
                drag: 0.9,
                life: 260,
                size: 1,
                color,
                alpha: 0.95,
                glow: true
            });
        }
    }

    /*
     * Pixel shards exploded outward when an enemy dies. Tint matches
     * the enemy's body color so a goblin pops green chunks, a skeleton
     * pops bone-white chunks, etc.
     */
    spawnDeathShards(x, y, tint = 0xb04848, count = 8) {
        for (let i = 0; i < count; i++) {
            const ang = Math.random() * Math.PI * 2;
            const speed = 60 + Math.random() * 80;
            this._spawn({
                x, y,
                vx: Math.cos(ang) * speed,
                vy: Math.sin(ang) * speed - 30,
                gravity: 280,
                drag: 0.9,
                life: 380 + Math.random() * 160,
                size: 2,
                color: tint,
                alpha: 1,
                squareFade: true
            });
        }
    }

    /*
     * Big golden burst when the player levels up. Spawns a ring + a
     * column of upward sparks. Used by GameScene right after the
     * camera flash so the player gets a visceral payoff.
     */
    spawnLevelUpBurst(x, y) {
        for (let i = 0; i < 16; i++) {
            const ang = (i / 16) * Math.PI * 2;
            const speed = 100 + Math.random() * 30;
            this._spawn({
                x, y,
                vx: Math.cos(ang) * speed,
                vy: Math.sin(ang) * speed,
                gravity: 0,
                drag: 0.86,
                life: 460,
                size: 2,
                color: 0xfff4a8,
                alpha: 1,
                glow: true
            });
        }
        for (let i = 0; i < 10; i++) {
            this._spawn({
                x: x + (Math.random() - 0.5) * 10,
                y: y + 4,
                vx: (Math.random() - 0.5) * 30,
                vy: -120 - Math.random() * 60,
                gravity: 60,
                drag: 0.95,
                life: 700,
                size: 1,
                color: 0xffe066,
                alpha: 1,
                glow: true
            });
        }
    }

    /*
     * Ground-crack puff fired when a boss spawns. Dust + dark debris
     * shoots up around the boss's feet, sells the impact.
     */
    spawnBossSpawnCrack(x, y) {
        for (let i = 0; i < 18; i++) {
            const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
            const speed = 60 + Math.random() * 80;
            this._spawn({
                x: x + (Math.random() - 0.5) * 18,
                y: y + (Math.random() - 0.5) * 4,
                vx: Math.cos(ang) * speed * 0.8,
                vy: Math.sin(ang) * speed,
                gravity: 280,
                drag: 0.92,
                life: 600,
                size: 2,
                color: i % 2 === 0 ? 0x2a1d0e : 0xff5050,
                alpha: 0.95,
                glow: i % 3 === 0
            });
        }
    }

    /*
     * Ring of soft sparkle particles when a treasure chest opens.
     */
    spawnChestOpen(x, y) {
        for (let i = 0; i < 14; i++) {
            const ang = (i / 14) * Math.PI * 2;
            const speed = 40 + Math.random() * 30;
            this._spawn({
                x, y,
                vx: Math.cos(ang) * speed,
                vy: Math.sin(ang) * speed - 30,
                gravity: 60,
                drag: 0.93,
                life: 600,
                size: 1,
                color: 0xfff088,
                alpha: 1,
                glow: true
            });
        }
    }

    /* -----------------------------------------------------------------
     * Weather - continuous emitters
     * ----------------------------------------------------------------- */

    setWeather(type) {
        this.weatherType = type;
    }

    _emitWeather(dt) {
        if (!this.weatherType) return;
        // Emit ~ this many particles per second
        const RATE = {
            rain: 90,
            snow: 25,
            embers: 18
        }[this.weatherType] || 0;
        if (RATE === 0) return;

        this._weatherAccumulator += (RATE * dt) / 1000;
        const cam = this.scene.cameras.main;

        while (this._weatherAccumulator >= 1) {
            this._weatherAccumulator -= 1;
            const x = Math.random() * cam.width;
            switch (this.weatherType) {
                case 'rain':
                    this._spawn({
                        x, y: -8,
                        vx: -40,
                        vy: 380,
                        life: 1400,
                        size: 1,
                        color: 0x9bdcff,
                        alpha: 0.6,
                        scrollFactor: 0
                    });
                    break;
                case 'snow':
                    this._spawn({
                        x, y: -4,
                        vx: -10 + Math.random() * 20,
                        vy: 35 + Math.random() * 25,
                        life: 5000,
                        size: 1 + (Math.random() < 0.3 ? 1 : 0),
                        color: 0xffffff,
                        alpha: 0.8,
                        scrollFactor: 0
                    });
                    break;
                case 'embers':
                    this._spawn({
                        x, y: cam.height + 4,
                        vx: -10 + Math.random() * 30,
                        vy: -50 - Math.random() * 30,
                        life: 2200,
                        size: 1,
                        color: Math.random() < 0.5 ? 0xff8a2a : 0xffe066,
                        alpha: 0.85,
                        scrollFactor: 0,
                        glow: true
                    });
                    break;
            }
        }
    }

    /* -----------------------------------------------------------------
     * Update + draw
     * ----------------------------------------------------------------- */

    update(time, dt) {
        const dts = dt / 1000;

        this._emitWeather(dt);

        this.gfx.clear();
        this.gfxAdd.clear();
        this.gfxWeather.clear();

        for (const s of this.pool) {
            if (!s.active) continue;
            // Integrate
            s.vx += s.ax * dts;
            s.vy += (s.ay + s.gravity) * dts;
            if (s.drag) {
                const k = 1 - s.drag * dts;
                s.vx *= k;
                s.vy *= k;
            }
            s.x += s.vx * dts;
            s.y += s.vy * dts;
            s.life -= dt;
            if (s.life <= 0) {
                s.active = false;
                continue;
            }

            // Fade towards 0 in the last 30% of life
            const t = s.life / s.maxLife;
            const fade = Math.min(1, t * 3);
            const a = s.alpha * fade;

            const target = s.scrollFactor === 0
                ? this.gfxWeather
                : (s.glow ? this.gfxAdd : this.gfx);

            target.fillStyle(s.color, a);
            target.fillRect(Math.round(s.x), Math.round(s.y), s.size, s.size);
        }
    }
}
