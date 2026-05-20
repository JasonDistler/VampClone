import { audio } from './AudioSystem.js';

/*
 * Heart pickups - the only source of healing now that all HP-related
 * upgrade cards have been removed from the level-up pool. Hearts spawn
 * on a randomized timer at random offsets near the player so they
 * appear scattered around the play area without dropping right under
 * the player's feet.
 *
 * Behavior:
 *   - First heart shows up after FIRST_SPAWN_DELAY_MS so the player
 *     isn't healed before they've taken any damage.
 *   - Subsequent hearts spawn every SPAWN_INTERVAL_MS +/- VARIANCE.
 *   - Hearts spawn at a random angle from the player, between
 *     MIN_DIST and MAX_DIST pixels away, so they're visible on screen
 *     but require some travel.
 *   - At most MAX_ALIVE hearts exist at once - if the player ignores
 *     hearts, the world doesn't pile up with them.
 *   - Each heart bobs gently (vertical sine wave) and despawns after
 *     LIFETIME_MS so the field stays tidy.
 *   - On overlap (within PICKUP_RADIUS) the player is healed by
 *     HEAL_PCT of their current maxHp (rounded down, min 1).
 *   - Hearts do NOT auto-magnet like XP gems - the player must walk
 *     onto them so the heal is a deliberate decision, not a freebie.
 */
/* Each heart heals a random percent of max HP, rolled at pickup time
 * within [HEAL_PCT_MIN, HEAL_PCT_MAX]. Variance keeps grabs interesting
 * - sometimes a heart is a clutch full-third top-up, sometimes just
 * patches you up. */
const HEAL_PCT_MIN = 0.20;
const HEAL_PCT_MAX = 0.40;

const FIRST_SPAWN_DELAY_MS = 6000;
/* Hearts spawn more often than they used to, and more can coexist on
 * the field, so the player has reliable healing options across all
 * three biomes regardless of how the run is going. */
const SPAWN_INTERVAL_MS = 11000;
const SPAWN_VARIANCE_MS = 4000;

const MIN_DIST = 140;
const MAX_DIST = 300;
const MAX_ALIVE = 9;
const LIFETIME_MS = 45000;
const PICKUP_RADIUS = 13;

export class HeartSystem {
    constructor(scene) {
        this.scene = scene;
        this.hearts = scene.physics.add.group();
        this.nextSpawnAt = scene.time.now + FIRST_SPAWN_DELAY_MS;
    }

    update(time) {
        if (this.scene.runState.gameOver) return;
        const player = this.scene.player;
        if (!player || !player.active) return;

        /* Bob + lifetime sweep. Lifetime expiry destroys the sprite so
         * the group naturally drains stale hearts. */
        const list = this.hearts.getChildren().slice();
        for (const h of list) {
            if (!h.active) continue;
            if (time - h.spawnedAt > LIFETIME_MS) {
                h.destroy();
                continue;
            }
            h.y = h.baseY + Math.sin((time + h.bobPhase) * 0.005) * 1.5;
            h.setDepth(h.baseY - 0.2);
        }

        /* Pickup detection. Player must physically walk over the heart
         * (no auto-magnet); we use a generous PICKUP_RADIUS so it
         * doesn't feel pixel-perfect. */
        const hearts = this.hearts.getChildren();
        for (const h of hearts) {
            if (!h.active) continue;
            const dx = player.x - h.x;
            const dy = player.y - h.y;
            if (dx * dx + dy * dy < PICKUP_RADIUS * PICKUP_RADIUS) {
                this.collect(h);
            }
        }

        /* Throttled spawn. Skips while we're already at the cap so
         * cleared but uncollected hearts get a chance to expire first.
         * The Famine curse (cursedNoHearts) suppresses ambient spawns
         * entirely - boss / chest hearts still drop. */
        const noHearts = this.scene.runState.cursedNoHearts;
        if (!noHearts && time >= this.nextSpawnAt && this.hearts.getLength() < MAX_ALIVE) {
            this.spawnNear(player);
            const variance = (Math.random() * 2 - 1) * SPAWN_VARIANCE_MS;
            this.nextSpawnAt = time + Math.max(8000, SPAWN_INTERVAL_MS + variance);
        }
    }

    spawnNear(player) {
        const angle = Math.random() * Math.PI * 2;
        const dist = MIN_DIST + Math.random() * (MAX_DIST - MIN_DIST);
        const x = player.x + Math.cos(angle) * dist;
        const y = player.y + Math.sin(angle) * dist;

        const sprite = this.scene.physics.add.sprite(x, y, 'heart');
        sprite.setOrigin(0.5, 0.95);
        sprite.setDepth(y - 0.2);
        sprite.setSize(8, 8);
        sprite.body.allowGravity = false;
        sprite.body.setImmovable(true);
        sprite.spawnedAt = this.scene.time.now;
        sprite.bobPhase = Math.random() * Math.PI * 2;
        sprite.baseY = y;

        /* Subtle pop-in: scale up briefly so it doesn't just appear. */
        sprite.setScale(0.5);
        this.scene.tweens.add({
            targets: sprite,
            scale: 1,
            duration: 220,
            ease: 'Back.easeOut'
        });

        this.hearts.add(sprite);
    }

    collect(heart) {
        const rs = this.scene.runState;
        if (rs.hp >= rs.maxHp) {
            /* Already topped off - don't waste the heart, leave it for
             * later in case the player takes a hit and circles back. */
            return;
        }
        const pct = HEAL_PCT_MIN + Math.random() * (HEAL_PCT_MAX - HEAL_PCT_MIN);
        const heal = Math.max(1, Math.floor(rs.maxHp * pct));
        rs.hp = Math.min(rs.maxHp, rs.hp + heal);
        audio.heartPickup();
        this.scene.particles?.spawnGemPop(heart.x, heart.y - 2, 0xff7a8a);

        /* Reuse the damage-numbers system for a green heal popup so
         * the player gets the same satisfying number-pop feedback. */
        if (this.scene.damageNumbers) {
            this.scene.damageNumbers.spawn(heart.x, heart.y - 4, `+${heal}`, '#7fffa6');
        }

        /* Quick grow-and-fade flourish before destroy. */
        this.scene.tweens.add({
            targets: heart,
            scale: 1.6,
            alpha: 0,
            duration: 180,
            ease: 'Cubic.easeOut',
            onComplete: () => heart.destroy()
        });
    }
}
