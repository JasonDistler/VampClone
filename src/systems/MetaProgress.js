/*
 * Meta-progression: persistent state that survives across runs.
 *
 * Stores in localStorage under a single key so we can rev the schema
 * by bumping META_VERSION. A bad / corrupt save is detected and
 * reset to defaults rather than crashing the game.
 *
 * Three orthogonal pieces live here:
 *
 *   1. gold        - currency awarded for kills / boss kills / elites,
 *                    cashed out at game-over (50% of run total) so
 *                    losing still rewards the player something.
 *
 *   2. unlocks     - permanent passives the player buys with gold:
 *                      hpUp1/2/3      +max HP each tier
 *                      dmgUp1/2       global damage buff
 *                      magnetUp       larger pickup magnet
 *                      armorUp        +1 baseline armor
 *                    plus character/weapon unlocks that gate cards
 *                    in the level-up scene until purchased:
 *                      char_pyra      Pyra is selectable
 *                      char_lyra      Lyra is selectable
 *                      char_borg      Borg is selectable
 *                      char_ranger    new content character
 *                      char_monk      new content character
 *                      weapon_whip
 *                      weapon_chain
 *                    Velorian + base weapons are unlocked from the
 *                    start so a fresh save still has a playable run.
 *
 *   3. achievements - flags + best stats. Achievements unlock once and
 *                     never re-fire so the toast queue isn't spammy.
 *
 * Daily-seed integration also stashes the last completed daily seed
 * + score here so the title screen can show "today's best".
 */

const META_KEY = 'sirVelorianMeta_v1';
const META_VERSION = 1;

const DEFAULTS = {
    version: META_VERSION,
    gold: 0,
    unlocks: {
        char_velorian: true,
        char_pyra: true,    // Free starter set
        char_lyra: true,    //   - keeping the existing roster free
        char_borg: true,    //   - so existing players aren't paywalled
        char_ranger: false,
        char_monk: false,
        // Mastery passives - the "weapon unlock" slots from earlier
        // designs were repurposed as straight-up passive multipliers.
        // The names still flavor toward the planned weapon archetypes.
        mastery_whip: false,
        mastery_chain: false,
        hpUp1: false,  hpUp2: false,  hpUp3: false,
        dmgUp1: false, dmgUp2: false,
        magnetUp: false,
        armorUp: false
    },
    achievements: {
        firstBlood:    false,
        survive5:      false,
        survive15:     false,
        kill100:       false,
        kill500:       false,
        firstBoss:     false,
        finalBoss:     false,
        evolveWeapon:  false,
        eliteHunter:   false,
        chestSeeker:   false,
        flawless5:     false
    },
    bestKills: 0,
    bestSurvivalSec: 0,
    dailyBest: { date: null, score: 0 }
};

const ACHIEVEMENT_DEFS = [
    { id: 'firstBlood',   name: 'First Blood',         icon: '\u2620' },
    { id: 'survive5',     name: 'Five Minutes',        icon: '\u23F2' },
    { id: 'survive15',    name: 'Quarter Hour',        icon: '\u23F2' },
    { id: 'kill100',      name: 'Centurion',           icon: '\u2694' },
    { id: 'kill500',      name: 'Reaper',              icon: '\u2694' },
    { id: 'firstBoss',    name: 'Knight Slayer',       icon: '\u265D' },
    { id: 'finalBoss',    name: 'Realm Reclaimer',     icon: '\u2606' },
    { id: 'evolveWeapon', name: 'Apex Arsenal',        icon: '\u26A1' },
    { id: 'eliteHunter',  name: 'Elite Hunter',        icon: '\u2605' },
    { id: 'chestSeeker',  name: 'Chest Seeker',        icon: '\u29BB' },
    { id: 'flawless5',    name: 'Untouchable',         icon: '\u2728' }
];

// Cost / build for unlocks. The cost is the gold gate; everything is
// sold at the title screen meta menu.
const UNLOCK_DEFS = [
    { id: 'hpUp1',        name: '+10% Max HP',          cost: 50,  desc: 'Permanently start with 10% more HP' },
    { id: 'hpUp2',        name: '+20% Max HP',          cost: 150, desc: 'Permanently start with 20% more HP', requires: 'hpUp1' },
    { id: 'hpUp3',        name: '+30% Max HP',          cost: 350, desc: 'Permanently start with 30% more HP', requires: 'hpUp2' },
    { id: 'dmgUp1',       name: '+8% Damage',           cost: 80,  desc: 'All weapons deal 8% more damage' },
    { id: 'dmgUp2',       name: '+15% Damage',          cost: 220, desc: 'All weapons deal 15% more damage', requires: 'dmgUp1' },
    { id: 'magnetUp',     name: '+30% Magnet',          cost: 60,  desc: 'Larger pickup radius from the start' },
    { id: 'armorUp',      name: '+1 Armor',             cost: 120, desc: 'Start every run with a flat point of armor' },
    { id: 'char_ranger',    name: 'Unlock: Ranger',         cost: 250, desc: 'Long-range bow specialist (poison arrows)' },
    { id: 'char_monk',      name: 'Unlock: Monk',           cost: 250, desc: 'Fast melee with shock fists' },
    { id: 'mastery_whip',   name: 'Mastery: Bleed',         cost: 180, desc: 'All weapon hits deal 12% more damage' },
    { id: 'mastery_chain',  name: 'Mastery: Storm',         cost: 220, desc: 'Aura damage +30%, larger radius' }
];

function loadRaw() {
    try {
        const raw = localStorage.getItem(META_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed?.version !== META_VERSION) return null;
        return parsed;
    } catch (e) {
        console.warn('[meta] failed to load, using defaults', e);
        return null;
    }
}

function saveRaw(state) {
    try {
        localStorage.setItem(META_KEY, JSON.stringify(state));
    } catch (e) {
        console.warn('[meta] failed to save', e);
    }
}

class MetaProgress {
    constructor() {
        // Deep-merge defaults so newly-added flags appear after a schema
        // bump without wiping existing progress.
        const loaded = loadRaw();
        this.state = JSON.parse(JSON.stringify(DEFAULTS));
        if (loaded) {
            this.state.gold = loaded.gold ?? 0;
            Object.assign(this.state.unlocks, loaded.unlocks || {});
            Object.assign(this.state.achievements, loaded.achievements || {});
            this.state.bestKills = loaded.bestKills ?? 0;
            this.state.bestSurvivalSec = loaded.bestSurvivalSec ?? 0;
            if (loaded.dailyBest) Object.assign(this.state.dailyBest, loaded.dailyBest);
        }
        this._achListeners = [];
    }

    save() { saveRaw(this.state); }

    /* -------- Gold -------- */

    addGold(amount) {
        this.state.gold = Math.max(0, Math.floor(this.state.gold + amount));
        this.save();
    }

    spendGold(amount) {
        if (this.state.gold < amount) return false;
        this.state.gold -= amount;
        this.save();
        return true;
    }

    getGold() { return this.state.gold; }

    /* -------- Unlocks -------- */

    isUnlocked(id) { return !!this.state.unlocks[id]; }

    unlockDefs() { return UNLOCK_DEFS; }

    canPurchase(id) {
        const def = UNLOCK_DEFS.find(u => u.id === id);
        if (!def) return false;
        if (this.isUnlocked(id)) return false;
        if (def.requires && !this.isUnlocked(def.requires)) return false;
        return this.state.gold >= def.cost;
    }

    purchase(id) {
        const def = UNLOCK_DEFS.find(u => u.id === id);
        if (!def || this.isUnlocked(id)) return false;
        if (!this.spendGold(def.cost)) return false;
        this.state.unlocks[id] = true;
        this.save();
        return true;
    }

    /*
     * Apply unlocked passives to a fresh runState. Called by GameScene
     * right after the runState is initialized so the buffs stack on top
     * of the character base stats.
     */
    applyToRunState(rs) {
        const u = this.state.unlocks;
        if (u.hpUp3) rs.maxHp = Math.round(rs.maxHp * 1.30);
        else if (u.hpUp2) rs.maxHp = Math.round(rs.maxHp * 1.20);
        else if (u.hpUp1) rs.maxHp = Math.round(rs.maxHp * 1.10);
        rs.hp = rs.maxHp;
        let dmg = 1.0;
        if (u.dmgUp2) dmg = 1.15;
        else if (u.dmgUp1) dmg = 1.08;
        if (u.mastery_whip) dmg *= 1.12;
        rs.metaDamageMult = dmg;
        if (u.magnetUp) rs.magnet *= 1.30;
        if (u.armorUp) rs.armor += 1;
        // Apply meta damage buff to the starting weapon stats so it
        // reads on the in-run stats panel and stacks naturally with
        // weapon damage upgrades.
        if (rs.weapon && rs.metaDamageMult > 1.0) {
            rs.weapon.damage = Math.round(rs.weapon.damage * rs.metaDamageMult);
        }
        // Aura mastery buffs the aura's base damage + radius so it's
        // already meaningful at the moment the player unlocks the aura
        // mid-run.
        if (u.mastery_chain && rs.aura) {
            rs.aura.damage = Math.round(rs.aura.damage * 1.30);
            rs.aura.radius = Math.round(rs.aura.radius * 1.15);
        }
    }

    /* -------- Achievements -------- */

    achievementDefs() { return ACHIEVEMENT_DEFS; }

    onAchievement(fn) { this._achListeners.push(fn); }

    award(id) {
        if (this.state.achievements[id]) return false;
        const def = ACHIEVEMENT_DEFS.find(a => a.id === id);
        if (!def) return false;
        this.state.achievements[id] = true;
        // Award a small gold bonus per achievement so the meta-loop
        // rewards exploration of game systems.
        this.addGold(50);
        for (const fn of this._achListeners) fn(def);
        this.save();
        return true;
    }

    /* -------- Run-end summary -------- */

    finishRun(summary) {
        this.state.bestKills = Math.max(this.state.bestKills, summary.kills || 0);
        this.state.bestSurvivalSec = Math.max(this.state.bestSurvivalSec, summary.survivalSec || 0);
        // Convert 50% of run-gold into permanent currency
        const earned = Math.floor((summary.runGold || 0) * 0.5);
        this.addGold(earned);
        return earned;
    }

    /* -------- Daily best -------- */

    recordDaily(date, score) {
        const existing = this.state.dailyBest;
        if (existing.date === date && existing.score >= score) return false;
        this.state.dailyBest = { date, score };
        this.save();
        return true;
    }

    getDailyBest() { return this.state.dailyBest; }
}

// Singleton - one progress store for the whole game
export const metaProgress = new MetaProgress();
