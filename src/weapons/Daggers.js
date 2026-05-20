/*
 * Projectile unlock - shared logic for every character's lvl-8 ranged
 * weapon. The runState.daggers config supplies the texture, tint,
 * count, and spread.
 *
 * Aim: every throw fires in the cardinal direction the player is
 * currently facing (player.facing is 'up' | 'down' | 'left' | 'right',
 * persisted from the last movement input). Multi-dagger throws still
 * fan out across `spreadRad` around that facing direction so a count >
 * 1 spread-shot config keeps its character flavor.
 *
 * Range:  every dagger travels exactly DAGGER_RANGE_PX pixels regardless
 *         of projectile speed, by deriving the lifetime from speed.
 * Pierce: every dagger can hit up to DAGGER_PIERCE enemies; the hit that
 *         exceeds that count destroys it (and triggers the explosion if
 *         the projectile is themed with one).
 */
const DAGGER_RANGE_PX = 300;
const DAGGER_PIERCE = 2;

const FACING_VECTORS = {
    up:    { dx: 0,  dy: -1 },
    down:  { dx: 0,  dy: 1  },
    left:  { dx: -1, dy: 0  },
    right: { dx: 1,  dy: 0  }
};

export class Daggers {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this.runState = scene.runState;
        this.nextThrowAt = 0;
    }

    update(time) {
        const def = this.runState.daggers;
        if (!def.active || this.runState.gameOver) return;
        if (time < this.nextThrowAt) return;

        const aim = FACING_VECTORS[this.player.facing] || FACING_VECTORS.down;

        this.nextThrowAt = time + def.cooldownMs;

        const baseAngle = Math.atan2(aim.dy, aim.dx);
        const count = Math.max(1, def.count);
        const spread = count > 1 ? (def.spreadRad ?? Math.PI / 8) : 0;
        for (let i = 0; i < count; i++) {
            const t = count === 1 ? 0 : (i / (count - 1)) - 0.5;
            const angle = baseAngle + t * spread;
            this.spawnDagger(Math.cos(angle), Math.sin(angle));
        }
    }

    spawnDagger(dx, dy) {
        const def = this.runState.daggers;
        const tex = def.texture || 'dagger';
        const dagger = this.scene.physics.add.sprite(this.player.x, this.player.y - 6, tex);
        dagger.damage = def.damage;
        // Fixed pierce count for every character's daggers; the per-
        // character def.pierce is intentionally ignored so the behavior
        // is consistent across heroes.
        dagger.pierce = DAGGER_PIERCE;
        dagger.hitSet = new Set();
        dagger.setOrigin(0.5, 0.5);
        if (def.tint !== undefined) dagger.setTint(def.tint);
        dagger.setDepth(this.player.y);
        dagger.setRotation(Math.atan2(dy, dx));
        dagger.setVelocity(dx * def.speed, dy * def.speed);
        dagger.spawnedAt = this.scene.time.now;
        // Range-locked: derive lifetime so distance traveled == DAGGER_RANGE_PX.
        // Velocity is constant after spawn so this is exact.
        const speed = Math.max(1, def.speed);
        dagger.lifetimeMs = (DAGGER_RANGE_PX / speed) * 1000;
        if (def.explosion) {
            dagger.explosionDamage = def.damage * (def.explosion.damageMult ?? 1.5);
            dagger.explosionRadius = def.explosion.radius ?? 24;
            dagger.explosionTint = def.explosion.tint;
        }
        this.scene.daggers.add(dagger);
    }
}
