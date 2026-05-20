import { Goblin } from '../entities/enemies/Goblin.js';
import { Skeleton } from '../entities/enemies/Skeleton.js';
import { OrcBrute } from '../entities/enemies/OrcBrute.js';
import { Bat } from '../entities/enemies/Bat.js';
import { Zombie } from '../entities/enemies/Zombie.js';
import { Wraith } from '../entities/enemies/Wraith.js';
import { Beholder } from '../entities/enemies/Beholder.js';
import { GoblinSniper } from '../entities/enemies/GoblinSniper.js';
import { GoblinBerserker } from '../entities/enemies/GoblinBerserker.js';
import { FireElemental } from '../entities/enemies/FireElemental.js';
import { Necrotech } from '../entities/enemies/Necrotech.js';
import { Shadowmancer } from '../entities/enemies/Shadowmancer.js';
import { DeathKnight } from '../entities/enemies/DeathKnight.js';
import { FrostGiant } from '../entities/enemies/FrostGiant.js';
import { Balor } from '../entities/enemies/Balor.js';
import { hudOverlay } from '../ui/HudOverlay.js';
import { audio } from './AudioSystem.js';

const ENEMY_CAP = 260;

/*
 * Boss minute markers - scheduled "set piece" encounters that punctuate
 * the run with named, supercharged versions of the heaviest enemy types.
 *
 * Flow:
 *   1. update() detects elapsed time crossing schedule[i].at and arms
 *      the boss banner + warning SFX. Regular spawns pause for 2.4s
 *      so the player can read the banner.
 *   2. After the banner delay, the bosses spawn on a single edge point
 *      with their HP and damage multiplied. They're tinted red so they
 *      stand out from regular elites and have isBoss=true so the death
 *      hook fires.
 *   3. Enemy.die() calls spawnDirector.handleBossDeath() which decrements
 *      the live-boss count. When all bosses for an entry are dead, we
 *      drop the rewards (extra hearts + a flurry of high-tier gems).
 *   4. Once all live bosses for the schedule entry are gone, normal music
 *      resumes (or the next entry takes over).
 *
 * Reward design: hearts replace the lost upgrade-card heals from the
 * previous balance pass. Gems are top-tier so a clutch boss kill gives
 * a meaningful XP windfall and a likely level-up to spend on weapon
 * picks before the next wave hits.
 */
const BOSS_SCHEDULE = [
    {
        at: 120,
        name: 'Knight of the Fall',
        spawns: [{ kind: 'death_knight', count: 1 }, { kind: 'skeleton', count: 4 }],
        hpMult: 3.0,
        dmgMult: 1.5,
        bannerHoldMs: 2200,
        rewards: { hearts: 1, gemTier: 2, gemCount: 8 }
    },
    {
        at: 300,
        name: 'Glacier Tyrant',
        spawns: [{ kind: 'frost_giant', count: 1 }],
        hpMult: 5.0,
        dmgMult: 1.8,
        bannerHoldMs: 2400,
        rewards: { hearts: 2, gemTier: 2, gemCount: 14 }
    },
    {
        at: 600,
        name: 'Twin Horrors',
        spawns: [{ kind: 'frost_giant', count: 1 }, { kind: 'balor', count: 1 }],
        hpMult: 7.0,
        dmgMult: 2.0,
        bannerHoldMs: 2600,
        rewards: { hearts: 3, gemTier: 2, gemCount: 22 }
    },
    {
        at: 900,
        name: 'The Infernal Triplet',
        spawns: [{ kind: 'balor', count: 3 }],
        hpMult: 10.0,
        dmgMult: 2.5,
        bannerHoldMs: 3000,
        // Final boss flag - on death we award the Realm Reclaimer
        // achievement and flip the run into endless mode (more spawns,
        // 1.5x score). After this point bosses keep spawning every 3
        // minutes from a procedural endless schedule.
        isFinal: true,
        rewards: { hearts: 5, gemTier: 2, gemCount: 40 }
    }
];

/*
 * Per-10-level scaling. Every 10 levels the player reaches, the spawn
 * rate goes up by LEVEL_RATE_BONUS_PER_TIER and pack spawns get
 * LEVEL_PACK_BONUS_PER_TIER additional enemies. So at level 20 the
 * battlefield is ~50% denser than level 1, at level 30 it's ~75%
 * denser, and pack spawns add 4-6 more enemies per group.
 *
 * Tier is floor(level / 10), so the bonus kicks in at L10, L20, L30...
 */
const LEVEL_RATE_BONUS_PER_TIER = 0.25;
const LEVEL_PACK_BONUS_PER_TIER = 2;

function levelTier(rs) {
    return Math.floor((rs?.level || 1) / 10);
}

/*
 * Global multiplier applied to every newly-spawned enemy's contact damage
 * (and to every enemy projectile's damage in GameScene.spawnEnemyProjectile).
 * A +50% bump makes hits feel weighty so the player can't tank-style
 * walk through swarms. Already-spawned enemies aren't retroactively
 * scaled - same pattern as hpScale().
 */
export const ENEMY_DAMAGE_MULT = 1.5;

const KIND_TO_CLASS = {
    goblin: Goblin,
    bat: Bat,
    skeleton: Skeleton,
    zombie: Zombie,
    wraith: Wraith,
    orc: OrcBrute,
    beholder: Beholder,
    goblin_sniper: GoblinSniper,
    goblin_berserker: GoblinBerserker,
    fire_elemental: FireElemental,
    necrotech: Necrotech,
    shadowmancer: Shadowmancer,
    death_knight: DeathKnight,
    frost_giant: FrostGiant,
    balor: Balor
};

/* Weighted spawn timeline. Each entry: { unlockAt (s), kind, baseWeight, peakAt }
 * Weight ramps in over 30s after unlock, holds at baseWeight, then slowly
 * fades after peakAt so older enemies stay around but newer ones dominate. */
const ENEMY_TIMELINE = [
    /* Wave 0 - swarm fodder */
    { unlockAt: 0,   kind: 'goblin',           baseWeight: 100, peakAt: 60 },
    { unlockAt: 20,  kind: 'goblin_sniper',    baseWeight: 50,  peakAt: 140 },
    { unlockAt: 30,  kind: 'bat',              baseWeight: 70,  peakAt: 140 },

    /* Wave 1 - mid-tier */
    { unlockAt: 60,  kind: 'goblin_berserker', baseWeight: 50,  peakAt: 220 },
    { unlockAt: 90,  kind: 'skeleton',         baseWeight: 55,  peakAt: 240 },
    { unlockAt: 130, kind: 'zombie',           baseWeight: 50,  peakAt: 280 },
    { unlockAt: 150, kind: 'fire_elemental',   baseWeight: 40,  peakAt: 320 },

    /* Wave 2 - heavies */
    { unlockAt: 200, kind: 'wraith',           baseWeight: 40,  peakAt: 360 },
    { unlockAt: 230, kind: 'necrotech',        baseWeight: 25,  peakAt: 400 },
    { unlockAt: 260, kind: 'orc',              baseWeight: 32,  peakAt: 420 },

    /* Wave 3 - rare elites */
    { unlockAt: 300, kind: 'shadowmancer',     baseWeight: 18,  peakAt: 460 },
    { unlockAt: 340, kind: 'beholder',         baseWeight: 22,  peakAt: 480 },
    { unlockAt: 380, kind: 'death_knight',     baseWeight: 12,  peakAt: 540 },

    /* Wave 4 - bosses (very rare) */
    { unlockAt: 460, kind: 'frost_giant',      baseWeight: 6,   peakAt: 620 },
    { unlockAt: 540, kind: 'balor',            baseWeight: 4,   peakAt: 700 }
];

export class SpawnDirector {
    constructor(scene) {
        this.scene = scene;
        this.spawnAccumulator = 0;
        this.nextPackAt = 45;

        this.nextBossIdx = 0;
        this.activeBosses = [];
        this.activeBossEntry = null;
        /* Pause regular enemy spawns until this elapsed-time so the
         * boss banner has the screen to itself and the boss arrives
         * dramatically (instead of being lost in a swarm). */
        this.spawnPauseUntil = 0;
        this._bossSpawnAt = 0;
    }

    update(time, dt) {
        const rs = this.scene.runState;
        if (rs.gameOver) return;
        const t = rs.elapsedMs / 1000;

        this.checkBossSchedule(t);
        this.checkEndlessBossSchedule(t);

        const diffMult = this.scene.difficultyMult?.spawn ?? 1;
        const tier = levelTier(rs);
        const levelMult = 1 + tier * LEVEL_RATE_BONUS_PER_TIER;
        const cursedMult = rs.cursedSpawnMult ?? 1;
        // Endless mode escalates spawn rate +50% on top of curses
        const endlessMult = rs.endlessMode ? 1.5 : 1.0;

        const ratePerSec = Math.min(2 + t * 0.65, 22) * diffMult * levelMult * cursedMult * endlessMult;
        this.spawnAccumulator += (ratePerSec * dt) / 1000;

        const spawnsPaused = t < this.spawnPauseUntil;

        if (!spawnsPaused) {
            while (this.spawnAccumulator >= 1) {
                this.spawnAccumulator -= 1;
                if (this.scene.enemies.getLength() >= ENEMY_CAP) break;
                this.spawnOne(t);
            }

            if (t >= this.nextPackAt && this.scene.enemies.getLength() < ENEMY_CAP - 30) {
                this.spawnPack(t);
                this.nextPackAt = t + 22 + Math.random() * 16;
            }
        } else {
            /* Cap accumulator while paused so we don't dump a
             * giant burst of spawns the moment the pause ends. */
            if (this.spawnAccumulator > 1) this.spawnAccumulator = 1;
        }

        if (this._bossSpawnAt > 0 && t >= this._bossSpawnAt) {
            this.doBossSpawn();
        }

        this.updateBossHpBar();
    }

    /* -----------------------------------------------------------------
     * Endless mode boss cadence. Once endlessMode is true (final boss
     * killed), spawn an escalating boss every 180s. Each cycle bumps
     * HP/dmg multipliers and rotates through the heaviest enemy types.
     * ----------------------------------------------------------------- */

    checkEndlessBossSchedule(t) {
        const rs = this.scene.runState;
        if (!rs.endlessMode) return;
        if (this.activeBossEntry) return;
        if (!this._endlessBossNextAt) {
            this._endlessBossNextAt = t + 30; // first wave 30s after final
            this._endlessCycle = 0;
        }
        if (t < this._endlessBossNextAt) return;
        this._endlessCycle += 1;
        const cycle = this._endlessCycle;
        const KINDS = ['balor', 'frost_giant', 'death_knight'];
        const kind = KINDS[cycle % KINDS.length];
        // Synthesize an entry on the fly so handleBossDeath rewards
        // and HP bar still work without a real schedule slot.
        this.activeBossEntry = {
            name: `Endless Wave ${cycle}`,
            spawns: [{ kind, count: 1 + Math.min(2, Math.floor(cycle / 3)) }],
            hpMult: 6 + cycle * 1.5,
            dmgMult: 2.0 + cycle * 0.2,
            bannerHoldMs: 2200,
            rewards: { hearts: 2, gemTier: 2, gemCount: 18 + cycle * 2 }
        };
        const holdSec = this.activeBossEntry.bannerHoldMs / 1000;
        this.spawnPauseUntil = t + holdSec;
        this._bossSpawnAt = t + holdSec;
        hudOverlay.showBossBanner(this.activeBossEntry.name, this.activeBossEntry.bannerHoldMs);
        audio.bossWarning?.();
        this._endlessBossNextAt = t + 180; // schedule next wave
    }

    /* -----------------------------------------------------------------
     * Boss schedule
     * ----------------------------------------------------------------- */

    checkBossSchedule(t) {
        if (this.nextBossIdx >= BOSS_SCHEDULE.length) return;
        const entry = BOSS_SCHEDULE[this.nextBossIdx];
        if (t < entry.at) return;

        // Arm the boss: show banner, pause spawns, queue the actual
        // boss-spawn for `bannerHoldMs` later so the player gets a
        // moment to react before the giant shows up.
        this.activeBossEntry = entry;
        const holdSec = (entry.bannerHoldMs ?? 2400) / 1000;
        this.spawnPauseUntil = t + holdSec + 0.6;
        this._bossSpawnAt = t + holdSec;
        this.nextBossIdx += 1;

        hudOverlay.showBossBanner(entry.name, entry.bannerHoldMs ?? 2400);
        audio.bossWarning();

        // Switch from biome music to the more intense boss theme
        // immediately - it telegraphs the encounter while the banner
        // is still flashing.
        audio.playMusic('boss');
    }

    doBossSpawn() {
        this._bossSpawnAt = 0;
        const entry = this.activeBossEntry;
        if (!entry) return;
        const point = this.randomEdgePoint();
        this.activeBosses = [];

        let bossHpTotal = 0;

        for (const grp of entry.spawns) {
            for (let i = 0; i < grp.count; i++) {
                const ox = (Math.random() - 0.5) * 30;
                const oy = (Math.random() - 0.5) * 30;
                const enemy = this.spawnAt(
                    { x: point.x + ox, y: point.y + oy },
                    grp.kind,
                    { isBoss: true, hpMult: entry.hpMult, dmgMult: entry.dmgMult }
                );
                if (enemy) {
                    this.activeBosses.push(enemy);
                    bossHpTotal += enemy.maxHp;
                }
            }
        }

        // Visceral spawn fanfare:
        //   - particle burst of dirt + ember at the spawn point
        //   - hit-stop kicker so the boss "lands" with weight
        //   - camera nudges toward the spawn point briefly so it
        //     feels like the camera flinches at the new threat
        this.scene.particles?.spawnBossSpawnCrack(point.x, point.y);
        this.scene.applyHitStop?.(140);
        this.scene.cameras.main.shake(280, 0.012);

        // Cache the combined max HP so the bar renders proportionally
        // even when one of two bosses is killed first.
        this._bossMaxHpTotal = bossHpTotal;
        hudOverlay.showBossHp(entry.name);
    }

    updateBossHpBar() {
        if (!this.activeBosses.length) return;
        let alive = 0;
        for (const b of this.activeBosses) {
            if (b && b.active) alive += b.hp;
        }
        hudOverlay.setBossHp(alive, this._bossMaxHpTotal || 1);
    }

    /*
     * Called by Enemy.die() when isBoss is true. Tracks remaining
     * bosses; on the last one we drop the rewards, hide the boss UI,
     * and switch music back to the biome theme.
     */
    handleBossDeath(boss) {
        this.activeBosses = this.activeBosses.filter(b => b !== boss && b.active);
        if (this.activeBosses.length > 0) return;

        const entry = this.activeBossEntry;
        if (!entry) return;
        const rewards = entry.rewards || {};

        const rs = this.scene.runState;
        rs.bossesKilled = (rs.bossesKilled || 0) + 1;
        rs.runGold = (rs.runGold || 0) + 80; // boss gold

        // Achievements
        this.scene._notifyAchievement?.('firstBoss', true);
        // The 15:00 / 900s "Realm Reclaimer" boss is the final one; if
        // this boss has the isFinal flag we award + flip endless on.
        if (entry.isFinal) {
            this.scene._notifyAchievement?.('finalBoss', true);
            rs.endlessMode = true;
            rs.scoreMult = (rs.scoreMult || 1) * 1.5;
        }

        audio.bossDeath();

        // Drop hearts on top of the boss corpse so the player has to
        // walk over and grab them - same rule as normal hearts.
        if (rewards.hearts && this.scene.heartSystem) {
            for (let i = 0; i < rewards.hearts; i++) {
                const angle = (i / rewards.hearts) * Math.PI * 2;
                const dist = 18 + Math.random() * 12;
                const x = boss.x + Math.cos(angle) * dist;
                const y = boss.y + Math.sin(angle) * dist;
                this._dropHeart(x, y);
            }
        }

        // Drop a flurry of top-tier gems. We bypass XpSystem's drop
        // chance roll so every gem is guaranteed - this is a reward.
        const gemCount = rewards.gemCount || 0;
        const tier = rewards.gemTier ?? 2;
        for (let i = 0; i < gemCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 8 + Math.random() * 28;
            const x = boss.x + Math.cos(angle) * dist;
            const y = boss.y + Math.sin(angle) * dist;
            this._forceDropGem(x, y, tier);
        }

        this.activeBossEntry = null;
        this._bossMaxHpTotal = 0;
        hudOverlay.hideBossHp();

        // Resume biome music after a short pause so the boss-death
        // sting can ring out without immediately being trampled by
        // the next track.
        this.scene.time.delayedCall(900, () => {
            if (this.scene.runState.gameOver) return;
            if (this.activeBossEntry) return; // another boss queued
            audio.playMusic(this.scene.environment.key);
        });
    }

    _dropHeart(x, y) {
        const sprite = this.scene.physics.add.sprite(x, y, 'heart');
        sprite.setOrigin(0.5, 0.95);
        sprite.setDepth(y - 0.2);
        sprite.setSize(8, 8);
        if (sprite.body) {
            sprite.body.allowGravity = false;
            sprite.body.setImmovable(true);
        }
        sprite.spawnedAt = this.scene.time.now;
        sprite.bobPhase = Math.random() * Math.PI * 2;
        sprite.baseY = y;
        sprite.setScale(0.5);
        this.scene.tweens.add({
            targets: sprite,
            scale: 1,
            duration: 220,
            ease: 'Back.easeOut'
        });
        this.scene.heartSystem.hearts.add(sprite);
    }

    /*
     * Elite drop bundle - guaranteed gold gem + heart, used by
     * Enemy.die when isElite is true. Also rolls a small chance to
     * spawn a treasure chest if the player doesn't already have one
     * pending pickup.
     */
    dropEliteBonus(x, y) {
        this._forceDropGem(x, y - 2, 2);
        this._dropHeart(x + 6, y + 4);
        // 18% chance the elite drops a chest, capped at 1 simultaneous
        // chest in the world to avoid screen-clutter.
        if (!this.scene.activeChest && Math.random() < 0.18) {
            this.spawnChestAt(x - 6, y);
        }
        // Award meta-gold (silently aggregated across the run; cashed
        // out on game-over).
        this.scene.runState.runGold = (this.scene.runState.runGold || 0) + 12;
    }

    /*
     * Spawn a treasure chest sprite in the world that opens on player
     * touch and grants a single random upgrade card pick.
     */
    spawnChestAt(x, y) {
        const chest = this.scene.physics.add.sprite(x, y, 'treasure_chest');
        chest.setOrigin(0.5, 0.85);
        chest.setDepth(y);
        chest.setSize(12, 10);
        if (chest.body) {
            chest.body.allowGravity = false;
            chest.body.setImmovable(true);
        }
        chest.setScale(0.4);
        this.scene.tweens.add({
            targets: chest,
            scale: 1,
            duration: 240,
            ease: 'Back.easeOut'
        });
        this.scene.tweens.add({
            targets: chest,
            y: y - 2,
            duration: 720,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        this.scene.activeChest = chest;
        this.scene._registerChest?.(chest);
    }

    _forceDropGem(x, y, tier) {
        const tierIndex = Math.min(2, Math.max(0, tier));
        const KEYS = ['gem_blue', 'gem_green', 'gem_gold'];
        const VALUES = [1, 3, 5];
        const sprite = this.scene.physics.add.sprite(x, y, KEYS[tierIndex]);
        sprite.setOrigin(0.5, 0.95);
        sprite.value = VALUES[tierIndex];
        sprite.setDepth(y - 0.25);
        sprite.setSize(8, 8);
        // Slight random burst velocity for visual juice
        if (sprite.body) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 70 + Math.random() * 80;
            sprite.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
            sprite.body.setDrag(280, 280);
        }
        this.scene.xpSystem.gems.add(sprite);
    }

    pickKind(t) {
        const pool = [];
        let total = 0;
        for (const entry of ENEMY_TIMELINE) {
            if (t < entry.unlockAt) continue;
            const sinceUnlock = t - entry.unlockAt;
            const ramp = Math.min(1, sinceUnlock / 30);
            let w = entry.baseWeight * ramp;
            if (t > entry.peakAt) {
                const sincePeak = t - entry.peakAt;
                w *= Math.max(0.25, 1 - sincePeak / 600);
            }
            if (w > 0.01) {
                pool.push({ kind: entry.kind, weight: w });
                total += w;
            }
        }
        if (pool.length === 0 || total <= 0) return 'goblin';
        let r = Math.random() * total;
        for (const e of pool) {
            r -= e.weight;
            if (r <= 0) return e.kind;
        }
        return pool[pool.length - 1].kind;
    }

    spawnOne(t) {
        this.spawnAt(this.randomEdgePoint(), this.pickKind(t));
    }

    spawnPack(t) {
        const point = this.randomEdgePoint();
        const tier = levelTier(this.scene.runState);
        const count = 5 + Math.floor(Math.random() * 5) + tier * LEVEL_PACK_BONUS_PER_TIER;
        const packKind = this.pickKind(t);
        for (let i = 0; i < count; i++) {
            const ox = (Math.random() - 0.5) * 44;
            const oy = (Math.random() - 0.5) * 44;
            const kind = Math.random() < 0.7 ? packKind : this.pickKind(t);
            this.spawnAt({ x: point.x + ox, y: point.y + oy }, kind);
        }
    }

    /*
     * Multiplier applied to each newly-spawned enemy's HP. Grows with
     * elapsed run time so early runs feel snappy (everything dies in 1-2
     * hits) while late runs become a wall of tank that the player has to
     * grind through with their level-50-tier weapons.
     *
     * Curve points (normal difficulty):
     *    0:00  -> 1.00x
     *    1:00  -> 1.30x
     *    3:00  -> 1.90x
     *    5:00  -> 2.50x
     *   10:00  -> 4.00x
     *   15:00  -> 5.50x
     *   20:00  -> 7.00x
     *
     * Already-spawned enemies don't retroactively get harder; only
     * fresh spawns scale up. Player damage upgrades over time keep pace.
     */
    hpScale(t) {
        const diffMult = this.scene.difficultyMult?.damage ?? 1;
        return (1 + t * 0.005) * diffMult;
    }

    spawnAt(point, kind, opts = {}) {
        const Cls = KIND_TO_CLASS[kind] || Goblin;
        const enemy = new Cls(this.scene, point.x, point.y);
        const rs = this.scene.runState;
        const t = rs.elapsedMs / 1000;

        // Elite chance: 1 in 30 by default, ramping slowly with elapsed
        // time. Bosses are never auto-elite (they're already tougher).
        const isElite = !opts.isBoss && Math.random() < (opts.eliteChance ?? this.eliteChance(t));

        const eliteHp  = isElite ? 4.0 : 1.0;
        const eliteDmg = isElite ? 1.4 : 1.0;

        // Curse + endless modifiers stack on top of the base scaling
        const cursedHp  = rs.cursedEnemyHpMult  ?? 1;
        const cursedDmg = rs.cursedEnemyDmgMult ?? 1;
        const cursedSpd = rs.cursedSpeedMult    ?? 1;
        // Endless mode: +30% HP and +20% dmg multiplicatively
        const endlessHp  = rs.endlessMode ? 1.3 : 1.0;
        const endlessDmg = rs.endlessMode ? 1.2 : 1.0;

        const mult = this.hpScale(t) * (opts.hpMult || 1) * eliteHp * cursedHp * endlessHp;
        enemy.hp = Math.round(enemy.hp * mult);
        enemy.maxHp = enemy.hp;
        if (typeof enemy.contactDamage === 'number') {
            const dmgBoost = ENEMY_DAMAGE_MULT * (opts.dmgMult || 1) * eliteDmg * cursedDmg * endlessDmg;
            enemy.contactDamage = Math.round(enemy.contactDamage * dmgBoost);
        }
        if (cursedSpd !== 1 && typeof enemy.speed === 'number') {
            enemy.speed = enemy.speed * cursedSpd;
        }
        if (opts.isBoss) {
            enemy.isBoss = true;
            // Larger silhouette + red angry tint so bosses read as bosses
            // even when they share an art base with elite spawns.
            enemy.setScale(1.45);
            enemy.setTint(0xff5555);
            enemy.gemTier = 2;
            // Bosses shrug off knockback so they don't get stunlocked
            // out of contact range by player damage cards.
            enemy.knockbackResist = Math.max(enemy.knockbackResist || 0, 0.85);
        } else if (isElite) {
            enemy.isElite = true;
            enemy.setScale(1.18);
            enemy.gemTier = 2;
            enemy.knockbackResist = Math.max(enemy.knockbackResist || 0, 0.4);
        }
        this.scene.enemies.add(enemy);
        return enemy;
    }

    /*
     * Elite spawn chance ramps gently with elapsed run time.
     *   t=0   -> 2%  (~1 in 50)
     *   t=120 -> 3.5%
     *   t=300 -> 5%
     *   t=600 -> 7%
     * Bosses + scheduled spawns opt out by passing eliteChance: 0.
     */
    eliteChance(t) {
        return Math.min(0.07, 0.02 + t * 0.00008);
    }

    randomEdgePoint() {
        const cam = this.scene.cameras.main;
        const margin = 40;
        const minX = cam.scrollX - margin;
        const minY = cam.scrollY - margin;
        const maxX = cam.scrollX + cam.width + margin;
        const maxY = cam.scrollY + cam.height + margin;
        const side = Math.floor(Math.random() * 4);
        if (side === 0) return { x: Phaser.Math.Between(minX, maxX), y: minY };
        if (side === 1) return { x: maxX, y: Phaser.Math.Between(minY, maxY) };
        if (side === 2) return { x: Phaser.Math.Between(minX, maxX), y: maxY };
        return { x: minX, y: Phaser.Math.Between(minY, maxY) };
    }
}
