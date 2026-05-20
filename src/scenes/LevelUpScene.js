import { hudOverlay } from '../ui/HudOverlay.js';
import { audio } from '../systems/AudioSystem.js';
import { GAME_CAMERA_ZOOM } from './GameScene.js';

/* Percent-scaled values start small and slowly grow every 5 levels:
 *   Levels 1-5  -> 1..2%
 *   Levels 6-10 -> 1..3%
 *   Levels 11-15-> 2..4%
 *   Levels 16-20-> 3..5%
 *   ...         -> +1% min, +1% max each tier from L11 onward
 *
 * The min stays clamped at 1% through the first two tiers so the early
 * game stays gentle - upgrades stack multiplicatively and a player will
 * grab many per run, and a quick run of 4-5 weapon picks at 1-2% each
 * shouldn't trivialize the first few minutes. The max climbs by 1% per
 * tier so reaching higher levels still feels like a tangible bump. */
function pctRange(level) {
    const tier = Math.floor((level - 1) / 5);
    const min = Math.max(1, tier);
    const max = 2 + tier;
    return [min, max];
}

function rollPct(level) {
    const [min, max] = pctRange(level);
    return Phaser.Math.Between(min, max);
}

/*
 * Weapon-style upgrades (the primary weapon, the aura, and the
 * projectile unlock) are capped per upgrade id:
 *
 *   picks 1..WEAPON_SOFT_CAP   -> full pctRange roll for the level
 *   picks SOFT+1..HARD_CAP     -> "scrap" tier roll of 2-3%
 *   picks > HARD_CAP           -> filtered out, never offered again
 *
 * Stat upgrades (HP, speed, magnet, lifesteal, armor, heal) are NOT in
 * this set - they keep their normal scaling without a cap.
 */
const WEAPON_UPGRADE_IDS = new Set([
    'wp_damage', 'wp_cooldown', 'wp_radius', 'wp_speed',
    'wp_count', 'wp_pierce',
    'aura_damage', 'aura_radius', 'aura_tick',
    'daggers_damage', 'daggers_cooldown', 'daggers_count', 'daggers_pierce'
]);
const WEAPON_SOFT_CAP = 5;
const WEAPON_HARD_CAP = 9;

/*
 * Per-id hard caps for non-weapon stat upgrades. Speed/magnet stack
 * multiplicatively and used to be infinite which got out of hand; armor
 * is a flat damage reduction so 5 picks already meaningfully blunts
 * most hits. Lifesteal was removed from the upgrade pool.
 */
const STAT_HARD_CAPS = {
    speed: 8,
    magnet: 8,
    armor: 5
};

function pickCount(rs, id) {
    return rs.upgradeCounts?.[id] || 0;
}

function isWeaponSoftCapped(rs, id) {
    return WEAPON_UPGRADE_IDS.has(id) && pickCount(rs, id) >= WEAPON_SOFT_CAP;
}

/*
 * Roll for percentage-style weapon upgrades. Returns the level-tier
 * roll for the first WEAPON_SOFT_CAP picks, then a flat 1-2% scrap
 * tier afterwards (kept below the level-1 floor so scrap picks always
 * feel weaker than fresh ones).
 */
function rollWeaponPct(rs, id) {
    if (isWeaponSoftCapped(rs, id)) {
        return Phaser.Math.Between(1, 2);
    }
    return rollPct(rs.level);
}

/* Each upgrade entry:
 *   id          unique
 *   title       big card text (caps)
 *   weight      relative pick chance
 *   available   (rs) -> bool
 *   type        'pct' | 'flat' | 'unlock'
 *   build(rs)   returns { desc, apply }, where apply takes (rs)
 */
const UPGRADES = [
    /* ---- Sir Velorian's Stats ----
     *
     * IRON CONSTITUTION (maxhp) and MENDING DRAUGHT (heal) cards were
     * removed from the upgrade pool. Healing is now exclusively
     * provided by the red heart pickups that spawn around the map
     * (see src/systems/HeartSystem.js). */
    {
        id: 'speed',
        title: 'SWIFT BOOTS',
        weight: 4,
        available: rs => pickCount(rs, 'speed') < STAT_HARD_CAPS.speed,
        build: rs => {
            const p = rollPct(rs.level);
            return {
                desc: `+${p}% move speed`,
                apply: r => { r.speed = r.speed * (1 + p / 100); }
            };
        }
    },
    {
        id: 'magnet',
        title: 'GEM CHARM',
        weight: 3,
        available: rs => pickCount(rs, 'magnet') < STAT_HARD_CAPS.magnet,
        build: rs => {
            /* Magnet is a quality-of-life stat - keep it on the same
             * curve as other percent stats rather than 2x-ing it. */
            const p = rollPct(rs.level);
            return {
                desc: `+${p}% magnet radius`,
                apply: r => { r.magnet = r.magnet * (1 + p / 100); }
            };
        }
    },
    /* CRIMSON RUNES (lifesteal) was removed entirely - lifesteal as a
     * passive sustain made the player feel safe in melee swarms. The
     * only healing source is the red heart pickups (HeartSystem.js). */
    {
        id: 'armor',
        title: 'PLATE OF THE ORDER',
        weight: 1,
        available: rs => pickCount(rs, 'armor') < STAT_HARD_CAPS.armor,
        build: () => ({
            desc: '+1 armor\n(flat damage reduction)',
            apply: r => { r.armor += 1; }
        })
    },
    /* MENDING DRAUGHT (heal) was removed; map-spawned hearts handle
     * recovery now. See src/systems/HeartSystem.js. */

    /* ---- Primary weapon (varies by character) ---- */
    {
        id: 'wp_damage',
        titleByCharacter: {
            velorian: 'EDGE OF VENGEANCE',
            borg: 'GLACIAL EDGE',
            pyra: 'INFERNAL CORE',
            lyra: 'UMBRAL EDGE'
        },
        title: 'WEAPON DAMAGE',
        weight: 4,
        available: rs => pickCount(rs, 'wp_damage') < WEAPON_HARD_CAP,
        build: rs => {
            const p = rollWeaponPct(rs, 'wp_damage');
            return {
                desc: `+${p}% ${weaponName(rs)} damage`,
                apply: r => { r.weapon.damage = r.weapon.damage * (1 + p / 100); }
            };
        }
    },
    {
        id: 'wp_cooldown',
        titleByCharacter: {
            velorian: 'WHIRLING STEEL',
            borg: 'AVALANCHE TEMPO',
            pyra: 'KINDLED FURY',
            lyra: 'QUICK FINGERS'
        },
        title: 'FASTER STRIKES',
        weight: 3,
        available: rs => pickCount(rs, 'wp_cooldown') < WEAPON_HARD_CAP,
        build: rs => {
            const p = rollWeaponPct(rs, 'wp_cooldown');
            return {
                desc: `-${p}% ${weaponName(rs)} cooldown`,
                apply: r => {
                    r.weapon.cooldownMs = Math.max(180, r.weapon.cooldownMs * (1 - p / 100));
                }
            };
        }
    },
    {
        id: 'wp_radius',
        titleByCharacter: {
            velorian: "LION'S REACH",
            borg: 'TITAN REACH'
        },
        title: 'WEAPON REACH',
        weight: 3,
        available: rs => rs.weapon.arcRadius !== undefined && pickCount(rs, 'wp_radius') < WEAPON_HARD_CAP,
        build: rs => {
            const p = rollWeaponPct(rs, 'wp_radius');
            return {
                desc: `+${p}% arc radius`,
                apply: r => { r.weapon.arcRadius = r.weapon.arcRadius * (1 + p / 100); }
            };
        }
    },
    {
        id: 'wp_count',
        title: 'EXTRA EMBER',
        weight: 3,
        available: rs => rs.characterId === 'pyra'
            && (rs.weapon.count || 0) < 12
            && pickCount(rs, 'wp_count') < WEAPON_HARD_CAP,
        build: () => ({
            desc: '+1 fire bolt per burst',
            apply: r => { r.weapon.count = (r.weapon.count || 6) + 1; }
        })
    },
    {
        id: 'wp_pierce',
        title: 'PIERCING SHADOW',
        weight: 3,
        available: rs => rs.characterId === 'lyra'
            && (rs.weapon.pierce || 0) < 8
            && pickCount(rs, 'wp_pierce') < WEAPON_HARD_CAP,
        build: () => ({
            desc: '+1 lance pierce',
            apply: r => { r.weapon.pierce = (r.weapon.pierce || 1) + 1; }
        })
    },
    {
        id: 'wp_speed',
        title: 'SHADOW VELOCITY',
        weight: 2,
        available: rs => (rs.characterId === 'lyra' || rs.characterId === 'pyra')
            && pickCount(rs, 'wp_speed') < WEAPON_HARD_CAP,
        build: rs => {
            const p = rollWeaponPct(rs, 'wp_speed');
            return {
                desc: `+${p}% projectile speed`,
                apply: r => { r.weapon.speed = (r.weapon.speed || 200) * (1 + p / 100); }
            };
        }
    },

    /* ---- Weapon evolutions ----
     *
     * Triggered when the base weapon has been heavily invested in
     * (damage + cooldown both pumped enough times) AND the player is
     * at least level 12. Each evolution dramatically upgrades the
     * weapon and is mutually exclusive (only the right one for the
     * current character is offered).
     *
     * Mechanically the evolution sets r.weapon.evolved = true and
     * gives a chunky multiplier so it feels like a real apex moment.
     * The actual visual / behavioral changes are gated on the
     * evolved flag in each weapon's implementation (sword arc grows
     * gold, fire bolts gain homing curve, etc.).
     */
    {
        id: 'evolve_velorian',
        title: 'EXCALIBUR ASCENDANT',
        weight: 14,
        available: rs => rs.characterId === 'velorian'
            && !rs.weapon.evolved
            && rs.level >= 12
            && pickCount(rs, 'wp_damage') >= 4
            && pickCount(rs, 'wp_cooldown') >= 3,
        build: () => ({
            desc: 'EVOLUTION\nGreatsword becomes\nholy gold; +60% dmg,\n-25% cooldown,\n+gold trail',
            apply: r => {
                r.weapon.evolved = true;
                r.weapon.damage *= 1.6;
                r.weapon.cooldownMs = Math.max(180, r.weapon.cooldownMs * 0.75);
                r.weapon.arcRadius = (r.weapon.arcRadius || 32) * 1.15;
            }
        })
    },
    {
        id: 'evolve_pyra',
        title: 'HELLFIRE STORM',
        weight: 14,
        available: rs => rs.characterId === 'pyra'
            && !rs.weapon.evolved
            && rs.level >= 12
            && pickCount(rs, 'wp_damage') >= 4
            && pickCount(rs, 'wp_count') >= 3,
        build: () => ({
            desc: 'EVOLUTION\nFire bolts curve\ntoward foes;\n+70% dmg,\n+3 bolts',
            apply: r => {
                r.weapon.evolved = true;
                r.weapon.damage *= 1.7;
                r.weapon.count = (r.weapon.count || 6) + 3;
                r.weapon.cooldownMs = Math.max(180, r.weapon.cooldownMs * 0.85);
            }
        })
    },
    {
        id: 'evolve_lyra',
        title: 'ETERNAL ECLIPSE',
        weight: 14,
        available: rs => rs.characterId === 'lyra'
            && !rs.weapon.evolved
            && rs.level >= 12
            && pickCount(rs, 'wp_damage') >= 4
            && pickCount(rs, 'wp_pierce') >= 2,
        build: () => ({
            desc: 'EVOLUTION\nLance pierces ALL,\nshocks each foe;\n+80% dmg',
            apply: r => {
                r.weapon.evolved = true;
                r.weapon.damage *= 1.8;
                r.weapon.pierce = 99;
                r.weapon.cooldownMs = Math.max(180, r.weapon.cooldownMs * 0.85);
            }
        })
    },
    {
        id: 'evolve_borg',
        title: "GLACIER'S WRATH",
        weight: 14,
        available: rs => rs.characterId === 'borg'
            && !rs.weapon.evolved
            && rs.level >= 12
            && pickCount(rs, 'wp_damage') >= 4
            && pickCount(rs, 'wp_radius') >= 3,
        build: () => ({
            desc: 'EVOLUTION\nMaul releases an ice\nshockwave per swing;\n+90% dmg',
            apply: r => {
                r.weapon.evolved = true;
                r.weapon.damage *= 1.9;
                r.weapon.arcRadius = (r.weapon.arcRadius || 38) * 1.25;
                r.weapon.cooldownMs = Math.max(220, r.weapon.cooldownMs * 0.9);
            }
        })
    },

    /* ---- Aura unlock (lvl 5, per-character themed) ---- */
    {
        id: 'unlock_aura',
        title: 'AURA OF SANCTITY',
        weight: 9,
        available: rs => !rs.aura.active && rs.level >= 5,
        titleResolver: rs => rs.aura.name || 'AURA OF SANCTITY',
        build: rs => ({
            desc: rs.aura.description || 'NEW WEAPON\nA radiant zone burns\nnearby foes',
            apply: r => { r.aura.active = true; }
        })
    },
    {
        id: 'aura_damage',
        title: 'DIVINE RETRIBUTION',
        weight: 3,
        available: rs => rs.aura.active && pickCount(rs, 'aura_damage') < WEAPON_HARD_CAP,
        build: rs => {
            const p = rollWeaponPct(rs, 'aura_damage');
            return {
                desc: `+${p}% aura damage`,
                apply: r => { r.aura.damage = r.aura.damage * (1 + p / 100); }
            };
        }
    },
    {
        id: 'aura_radius',
        title: 'HALLOWED GROUND',
        weight: 3,
        available: rs => rs.aura.active && pickCount(rs, 'aura_radius') < WEAPON_HARD_CAP,
        build: rs => {
            const p = rollWeaponPct(rs, 'aura_radius');
            return {
                desc: `+${p}% aura radius`,
                apply: r => { r.aura.radius = r.aura.radius * (1 + p / 100); }
            };
        }
    },
    {
        id: 'aura_tick',
        title: 'PURIFYING PULSE',
        weight: 2,
        available: rs => rs.aura.active && rs.aura.tickMs > 220 && pickCount(rs, 'aura_tick') < WEAPON_HARD_CAP,
        build: rs => {
            const p = rollWeaponPct(rs, 'aura_tick');
            return {
                desc: `-${p}% aura tick rate`,
                apply: r => { r.aura.tickMs = Math.max(220, r.aura.tickMs * (1 - p / 100)); }
            };
        }
    },

    /* ---- Projectile unlock (lvl 8, per-character themed) ---- */
    {
        id: 'unlock_daggers',
        title: 'DAGGERS OF AVALON',
        weight: 9,
        available: rs => !rs.daggers.active && rs.level >= 8,
        titleResolver: rs => rs.daggers.name || 'DAGGERS OF AVALON',
        build: rs => ({
            desc: rs.daggers.description || 'NEW WEAPON\nThrown daggers fly\nin your facing',
            apply: r => { r.daggers.active = true; }
        })
    },
    {
        id: 'daggers_damage',
        title: 'WHETSTONE',
        weight: 3,
        available: rs => rs.daggers.active && pickCount(rs, 'daggers_damage') < WEAPON_HARD_CAP,
        build: rs => {
            const p = rollWeaponPct(rs, 'daggers_damage');
            return {
                desc: `+${p}% dagger damage`,
                apply: r => { r.daggers.damage = r.daggers.damage * (1 + p / 100); }
            };
        }
    },
    {
        id: 'daggers_cooldown',
        title: 'QUICK FINGERS',
        weight: 3,
        available: rs => rs.daggers.active && pickCount(rs, 'daggers_cooldown') < WEAPON_HARD_CAP,
        build: rs => {
            const p = rollWeaponPct(rs, 'daggers_cooldown');
            return {
                desc: `-${p}% throw cooldown`,
                apply: r => { r.daggers.cooldownMs = Math.max(180, r.daggers.cooldownMs * (1 - p / 100)); }
            };
        }
    },
    {
        id: 'daggers_count',
        title: 'EXTRA BLADE',
        weight: 2,
        available: rs => rs.daggers.active
            && rs.daggers.count < 5
            && pickCount(rs, 'daggers_count') < WEAPON_HARD_CAP,
        build: () => ({
            desc: '+1 dagger per throw',
            apply: r => { r.daggers.count += 1; }
        })
    },
    /* "KEEN EDGE" (daggers_pierce) was removed because dagger pierce
     * is now hard-locked at DAGGER_PIERCE (3) in src/weapons/Daggers.js
     * regardless of runState. */
];

function weaponName(rs) {
    return rs.weaponName || 'weapon';
}

function resolveWeight(u, rs) {
    return typeof u.weight === 'function' ? u.weight(rs) : u.weight;
}

function pickThree(rs) {
    const eligible = UPGRADES
        .filter(u => u.available(rs))
        .map(u => ({ u, w: resolveWeight(u, rs) }))
        .filter(e => e.w > 0);
    if (eligible.length === 0) return [];

    const totalWeight = eligible.reduce((acc, e) => acc + e.w, 0);
    const picked = [];
    const used = new Set();

    while (picked.length < 3 && picked.length < eligible.length) {
        let r = Math.random() * totalWeight;
        let chosen = null;
        for (const { u, w } of eligible) {
            if (used.has(u.id)) continue;
            r -= w;
            if (r <= 0) { chosen = u; break; }
        }
        if (!chosen) {
            for (const { u } of eligible) {
                if (!used.has(u.id)) { chosen = u; break; }
            }
        }
        if (!chosen) break;
        used.add(chosen.id);
        const built = chosen.build(rs);
        let title;
        if (chosen.titleResolver) title = chosen.titleResolver(rs);
        else if (chosen.titleByCharacter && chosen.titleByCharacter[rs.characterId]) title = chosen.titleByCharacter[rs.characterId];
        else title = chosen.title;

        /*
         * Surface upgrade-cap state in the card description so the
         * player understands why a weapon roll just dropped to 2-3%
         * (and how many "scrap" picks remain before the upgrade is
         * gone for the rest of the run).
         */
        let desc = built.desc;
        if (WEAPON_UPGRADE_IDS.has(chosen.id)) {
            const count = pickCount(rs, chosen.id);
            const remaining = WEAPON_HARD_CAP - count;
            if (count >= WEAPON_SOFT_CAP) {
                desc += `\n\nSCRAP TIER (${remaining} pick${remaining === 1 ? '' : 's'} left)`;
            } else if (count === WEAPON_SOFT_CAP - 1) {
                desc += `\n\nLast full upgrade!`;
            }
        }

        picked.push({
            id: chosen.id,
            title,
            desc,
            apply: built.apply
        });
    }
    return picked;
}

export class LevelUpScene extends Phaser.Scene {
    constructor() {
        super('LevelUpScene');
    }

    init(data) {
        this.runState = data.runState;
        this.chosen = false;
    }

    create() {
        this.chosen = false;

        audio.levelUp();

        const range = pctRange(this.runState.level);
        const cards = pickThree(this.runState);

        if (cards.length === 0) {
            this.time.delayedCall(80, () => this.resolve({ apply: () => {} }));
            return;
        }

        this.cards = cards;

        hudOverlay.showLevelUp(this.runState.level, range, cards, picked => this.resolve(picked));

        if (cards[0]) this.input.keyboard.once('keydown-ONE', () => this.resolve(cards[0]));
        if (cards[1]) this.input.keyboard.once('keydown-TWO', () => this.resolve(cards[1]));
        if (cards[2]) this.input.keyboard.once('keydown-THREE', () => this.resolve(cards[2]));

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => hudOverlay.hideLevelUp());
    }

    resolve(card) {
        if (this.chosen) return;
        this.chosen = true;
        audio.uiClick();
        if (card && card.id) {
            if (!this.runState.upgradeCounts) this.runState.upgradeCounts = {};
            this.runState.upgradeCounts[card.id] = (this.runState.upgradeCounts[card.id] || 0) + 1;
        }
        card.apply(this.runState);
        const game = this.scene.get('GameScene');
        // Evolution achievement - any of the 4 evolve_* card ids count
        if (card.id && card.id.startsWith('evolve_')) {
            game._notifyAchievement?.('evolveWeapon', true);
        }
        hudOverlay.hideLevelUp();
        this.cameras.main.flash(140, 245, 197, 75);
        this.scene.stop();
        game.scene.resume();
        // Zoom-kicker eases UP from the gameplay base zoom and then
        // back to it - keeps the playfield-wide view consistent.
        game.cameras.main.zoomTo(GAME_CAMERA_ZOOM * 1.05, 80, 'Sine.easeOut');
        game.time.delayedCall(80, () => {
            game.cameras.main.zoomTo(GAME_CAMERA_ZOOM, 140, 'Sine.easeIn');
        });
        game.handleLevelUpResolved();
    }
}
