import { audio } from '../systems/AudioSystem.js';
import { statusTint, statusSpeedMult } from '../systems/StatusEffects.js';

/*
 * Base enemy class. Subclasses override `defaults()` to set hp, damage,
 * sprite, etc. The seek+separation steering is shared.
 *
 * Movement note: every enemy walks at a single uniform base speed
 * (BASE_ENEMY_SPEED). Per-class `opts.speed` is intentionally ignored so
 * the chase pace is predictable and slower than the player. Subclass
 * behaviors that need their own velocity (Skeleton bone toss, Goblin
 * Berserker charge, Bat dive, etc.) still use their own speed values
 * because those are "behavior" speeds, not the base walk speed.
 *
 * Difficulty over time comes from HP scaling (applied in SpawnDirector)
 * and from spawn rate/density - never from making enemies move faster.
 */
export const BASE_ENEMY_SPEED = 85;

export class Enemy extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, opts) {
        super(scene, x, y, opts.texture);
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.scene = scene;
        this.hp = opts.hp;
        this.maxHp = opts.hp;
        this.speed = BASE_ENEMY_SPEED;
        this.contactDamage = opts.contactDamage;
        this.gemTier = opts.gemTier || 0;
        this.scoreBaseId = opts.id || 'enemy';
        this.knockbackResist = opts.knockbackResist || 0;
        this.ignoreSeparation = opts.ignoreSeparation || false;
        this.bodyW = opts.bodyW || 10;
        this.bodyH = opts.bodyH || 10;
        this.bodyOffsetY = opts.bodyOffsetY || 4;

        this.setOrigin(0.5, 0.95);
        this.setSize(this.bodyW, this.bodyH);
        this.setOffset((this.width - this.bodyW) / 2, this.height - this.bodyH - this.bodyOffsetY);
        this.setCollideWorldBounds(false);

        if (opts.walkAnim) this.play(opts.walkAnim);

        this.shadow = scene.add.image(x, y, opts.shadowKey || 'shadow_small');
        this.shadow.setAlpha(0.5);

        this.lastHitTint = 0;
        this.knockbackVx = 0;
        this.knockbackVy = 0;
    }

    update(time, dt) {
        if (!this.active) return;
        const player = this.scene.player;
        if (!player || !player.active) return;

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy) || 1;
        // Status-effect velocity dampening (freeze, shock pin)
        const sMult = statusSpeedMult(this);
        let vx = (dx / dist) * this.speed * sMult;
        let vy = (dy / dist) * this.speed * sMult;

        if (!this.ignoreSeparation) {
            const others = this.scene.enemies.getChildren();
            let sx = 0, sy = 0;
            for (const other of others) {
                if (other === this || !other.active) continue;
                if (other.ignoreSeparation) continue;
                const odx = this.x - other.x;
                const ody = this.y - other.y;
                const od2 = odx * odx + ody * ody;
                if (od2 > 0 && od2 < 18 * 18) {
                    const w = 1 - Math.sqrt(od2) / 18;
                    sx += odx * w;
                    sy += ody * w;
                }
            }
            vx += sx * 1.5;
            vy += sy * 1.5;
        }

        if (this.knockbackVx !== 0 || this.knockbackVy !== 0) {
            vx += this.knockbackVx;
            vy += this.knockbackVy;
            this.knockbackVx *= 0.82;
            this.knockbackVy *= 0.82;
            if (Math.abs(this.knockbackVx) < 4) this.knockbackVx = 0;
            if (Math.abs(this.knockbackVy) < 4) this.knockbackVy = 0;
        }

        this.setVelocity(vx, vy);

        if (Math.abs(dx) > 4) {
            this.setFlipX(dx < 0);
        }

        if (this.shadow) {
            this.shadow.setPosition(this.x, this.y - 1);
            this.shadow.setDepth(this.y - 0.5);
        }
        this.setDepth(this.y);

        if (time < this.lastHitTint) {
            this.setTintFill(0xffffff);
        } else if (this.isElite) {
            // Elites get a permanent gold-tinted aura tint so they're
            // immediately readable as the high-value target in a swarm.
            this.setTint(0xffd24a);
        } else if (this.isBoss) {
            // Bosses keep a permanent angry-red tint so they read as
            // a different threat tier even at a glance.
            this.setTint(0xff5555);
        } else {
            // Status-effect tints are below boss/elite priority but above
            // "no tint" so a frozen swarm reads icy-blue.
            const st = statusTint(this);
            if (st !== null) this.setTint(st);
            else this.clearTint();
        }

        this.subUpdate?.(time, dt);
    }

    takeDamage(amount, source) {
        if (!this.active) return;
        this.hp -= amount;
        this.lastHitTint = this.scene.time.now + 90;
        this.scene.damageNumbers.spawn(this.x, this.y - this.height * 0.6, amount);
        audio.enemyHit();

        // Direction-aware blood/ichor spray. Tint defaults to a
        // generic dark red but Skeleton/Wraith/Bone enemies override
        // bloodTint in their constructor.
        if (this.scene.particles && amount > 0) {
            const sx = source?.x ?? this.x;
            const sy = source?.y ?? this.y;
            const dx = this.x - sx;
            const dy = this.y - sy - 4;
            this.scene.particles.spawnBlood(
                this.x, this.y - this.height * 0.5,
                dx, dy,
                this.bloodTint ?? 0x8a1818
            );
        }

        // Hit-stop: if this hit dealt more than 20% of the enemy's max
        // HP (or kills them), briefly freeze gameplay for ~70ms so the
        // player feels the weight of a big swing. The effect is owned
        // by the scene so multiple enemies hit in the same frame don't
        // stack their freezes.
        if (this.scene.applyHitStop && (amount >= this.maxHp * 0.2 || this.hp <= 0)) {
            this.scene.applyHitStop(this.hp <= 0 ? 100 : 65);
        }

        if (source && this.knockbackResist < 1) {
            const dx = this.x - source.x;
            const dy = this.y - source.y;
            const d = Math.hypot(dx, dy) || 1;
            const k = 140 * (1 - this.knockbackResist);
            this.knockbackVx += (dx / d) * k;
            this.knockbackVy += (dy / d) * k;
        }

        if (this.hp <= 0) {
            this.die();
        }
    }

    die() {
        const rs = this.scene.runState;
        rs.kills += 1;

        // Run-gold accrual scales with enemy difficulty:
        //   trash mob (~maxHp 14)        -> 1 gold
        //   medium  (~maxHp 60)          -> 3 gold
        //   tough   (~maxHp 150)         -> 6 gold
        //   boss    (>maxHp 300)         -> 30+ gold (handled in
        //                                   handleBossDeath rewards)
        const goldEarned = Math.max(1, Math.floor(this.maxHp * 0.04));
        rs.runGold = (rs.runGold || 0) + goldEarned;

        if (this.isElite) {
            rs.elitesKilled = (rs.elitesKilled || 0) + 1;
            this.scene._notifyAchievement?.('eliteHunter', rs.elitesKilled >= 5);
        }

        this.scene._notifyAchievement?.('firstBlood', true);
        this.scene._notifyAchievement?.('kill100',  rs.kills >= 100);
        this.scene._notifyAchievement?.('kill500',  rs.kills >= 500);

        this.scene.xpSystem.dropGem(this.x, this.y, this.gemTier);

        // Elite bonus drops - guaranteed gold gem + heart, plus a
        // little gold currency credit if meta-progression is active.
        if (this.isElite) {
            this.scene.spawnDirector?.dropEliteBonus?.(this.x, this.y);
        }

        // Pixel-shard explosion - more shards for bigger enemies, tinted
        // to roughly match the body color
        if (this.scene.particles) {
            const tint = this.bodyTint ?? this.shardTint ?? 0xb04848;
            const count = this.isBoss ? 24 : (this.maxHp > 80 ? 14 : 8);
            this.scene.particles.spawnDeathShards(this.x, this.y - this.height * 0.5, tint, count);
        }

        if (this.isBoss) {
            // The big triumphant sting is gated to the LAST boss kill
            // inside SpawnDirector.handleBossDeath; per-boss death just
            // gets the regular thump so twin/triplet kills don't stack
            // multiple stings on top of each other.
            audio.enemyDeath();
            this.scene.spawnDirector?.handleBossDeath?.(this);
        } else {
            audio.enemyDeath();
        }
        this.kill();
    }

    kill() {
        if (this.shadow) this.shadow.destroy();
        this.destroy();
    }
}
