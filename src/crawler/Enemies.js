/*
 * Enemy library for Crawler Mode.
 *
 * Each enemy is described declaratively:
 *   - hp: starting and max HP
 *   - spriteKey: which sprite painter to use for the portrait. The
 *     painters live in src/art/PixelArt.js and are mapped 1:1 to
 *     entries in SPRITE_PAINTERS in CrawlerUI.js.
 *   - intentPattern: array of intents the enemy cycles through, looping
 *     at the end. Each intent is { kind, ... } where kind drives the
 *     icon shown above the enemy and the action taken on its turn.
 *   - isElite: optional flag; elites use a richer visual frame and
 *     guarantee a relic drop on victory.
 *   - isBoss: optional flag; bosses end the floor.
 *
 * Intent shapes:
 *   { kind: 'attack',     amount: N }
 *   { kind: 'block',      amount: N }
 *   { kind: 'attackVuln', amount: N, vuln: M }
 *   { kind: 'debuff',     vuln: M }
 *   { kind: 'drain',      amount: N, heal: N }
 *   { kind: 'multiAttack', amount: N, hits: M }    // hits player M times for N
 *   { kind: 'buffSelf',   strength: N }            // gain strength
 *   { kind: 'summonBlock', amount: N, allyAmount: N } // self block + all allies
 *
 * Single-action intents per turn keep the engine simple while still
 * giving each enemy a readable rotation. Telegraphing every action one
 * turn ahead is the standard genre convention so the player can plan.
 */

export const ENEMY_LIBRARY = {

    /* =========================================================
     *  Floor 1 — entrance / forest / crypt / sanctum
     * ========================================================= */

    goblinScout: {
        id: 'goblinScout', name: 'Goblin Scout',
        hp: 14, spriteKey: 'goblin_0', accent: '#7adf6e',
        intentPattern: [
            { kind: 'attack', amount: 6 },
            { kind: 'block',  amount: 5 },
            { kind: 'attack', amount: 4 }
        ]
    },
    caveBat: {
        id: 'caveBat', name: 'Cave Bat',
        hp: 9, spriteKey: 'bat_0', accent: '#7feaff',
        intentPattern: [
            { kind: 'attack', amount: 4 },
            { kind: 'attack', amount: 4 },
            { kind: 'multiAttack', amount: 2, hits: 2 }
        ]
    },
    skeleton: {
        id: 'skeleton', name: 'Restless Skeleton',
        hp: 22, spriteKey: 'skeleton_0', accent: '#cfd6e0',
        intentPattern: [
            { kind: 'attack', amount: 8 },
            { kind: 'attackVuln', amount: 5, vuln: 1 }
        ]
    },
    beholder: {
        id: 'beholder', name: 'Lesser Beholder',
        hp: 18, spriteKey: 'beholder_0', accent: '#c97aff',
        intentPattern: [
            { kind: 'debuff', vuln: 2 },
            { kind: 'attack', amount: 7 },
            { kind: 'attack', amount: 7 }
        ]
    },

    /* Floor 1 elite — slightly tougher, guaranteed relic on kill */
    goblinChieftain: {
        id: 'goblinChieftain', name: 'Goblin Chieftain',
        hp: 38, isElite: true, spriteKey: 'goblin_1', accent: '#ffd03c',
        intentPattern: [
            { kind: 'attack', amount: 9 },
            { kind: 'summonBlock', amount: 6, allyAmount: 4 },
            { kind: 'attack', amount: 7 },
            { kind: 'buffSelf', strength: 1 }
        ]
    },
    bogWraith: {
        id: 'bogWraith', name: 'Bog Wraith',
        hp: 32, isElite: true, spriteKey: 'wraith_1', accent: '#7feaff',
        intentPattern: [
            { kind: 'drain', amount: 4, heal: 4 },
            { kind: 'attackVuln', amount: 5, vuln: 1 },
            { kind: 'attack', amount: 6 }
        ]
    },

    /* Floor 1 boss */
    wraithBoss: {
        id: 'wraithBoss', name: 'Hollow Wraith',
        hp: 60, isBoss: true, spriteKey: 'wraith_0', accent: '#7feaff',
        intentPattern: [
            { kind: 'attack', amount: 7 },
            { kind: 'attack', amount: 7 },
            { kind: 'drain', amount: 5, heal: 5 },
            { kind: 'attackVuln', amount: 4, vuln: 2 }
        ]
    },

    /* =========================================================
     *  Floor 2 — orc warband / necropolis
     * ========================================================= */

    orcBrute: {
        id: 'orcBrute', name: 'Orc Brute',
        hp: 30, spriteKey: 'orcBrute_0', accent: '#a06030',
        intentPattern: [
            { kind: 'attack', amount: 11 },
            { kind: 'block',  amount: 6 },
            { kind: 'attack', amount: 9 }
        ]
    },
    zombie: {
        id: 'zombie', name: 'Shambling Zombie',
        hp: 28, spriteKey: 'zombie_0', accent: '#5e7a3a',
        intentPattern: [
            { kind: 'attack', amount: 7 },
            { kind: 'attack', amount: 7 },
            { kind: 'debuff', vuln: 2 }
        ]
    },
    necroAcolyte: {
        id: 'necroAcolyte', name: 'Necro Acolyte',
        hp: 24, spriteKey: 'necrotech_0', accent: '#9050d0',
        intentPattern: [
            { kind: 'debuff', vuln: 2 },
            { kind: 'attackVuln', amount: 6, vuln: 1 },
            { kind: 'block', amount: 5 }
        ]
    },

    /* Floor 2 elites */
    orcWarchief: {
        id: 'orcWarchief', name: 'Orc Warchief',
        hp: 60, isElite: true, spriteKey: 'orcBrute_1', accent: '#ffd03c',
        intentPattern: [
            { kind: 'buffSelf', strength: 2 },
            { kind: 'attack', amount: 9 },
            { kind: 'attack', amount: 9 },
            { kind: 'block', amount: 8 }
        ]
    },
    darkPriest: {
        id: 'darkPriest', name: 'Dark Priest',
        hp: 48, isElite: true, spriteKey: 'necrotech_1', accent: '#c050ff',
        intentPattern: [
            { kind: 'attackVuln', amount: 6, vuln: 2 },
            { kind: 'drain', amount: 5, heal: 8 },
            { kind: 'debuff', vuln: 3 }
        ]
    },

    /* Floor 2 boss */
    balor: {
        id: 'balor', name: 'Balor of Shadow',
        hp: 95, isBoss: true, spriteKey: 'balor_0', accent: '#ff5050',
        intentPattern: [
            { kind: 'attack', amount: 10 },
            { kind: 'multiAttack', amount: 4, hits: 3 },
            { kind: 'block', amount: 12 },
            { kind: 'attackVuln', amount: 8, vuln: 2 },
            { kind: 'buffSelf', strength: 1 }
        ]
    },

    /* =========================================================
     *  Floor 3 — dread keep / icy citadel
     * ========================================================= */

    deathKnight: {
        id: 'deathKnight', name: 'Death Knight',
        hp: 44, spriteKey: 'deathKnight_0', accent: '#cf6b6b',
        intentPattern: [
            { kind: 'attack', amount: 14 },
            { kind: 'block', amount: 8 },
            { kind: 'attackVuln', amount: 8, vuln: 1 }
        ]
    },
    shadowmancer: {
        id: 'shadowmancer', name: 'Shadowmancer',
        hp: 36, spriteKey: 'shadowmancer_0', accent: '#9070ff',
        intentPattern: [
            { kind: 'multiAttack', amount: 4, hits: 2 },
            { kind: 'debuff', vuln: 3 },
            { kind: 'attack', amount: 9 }
        ]
    },
    iceTroll: {
        id: 'iceTroll', name: 'Ice Troll',
        hp: 50, spriteKey: 'frostGiant_0', accent: '#7feaff',
        intentPattern: [
            { kind: 'block', amount: 12 },
            { kind: 'attack', amount: 12 },
            { kind: 'attack', amount: 9 }
        ]
    },

    /* Floor 3 elites */
    skeleKing: {
        id: 'skeleKing', name: 'Skeleton King',
        hp: 78, isElite: true, spriteKey: 'skeleton_1', accent: '#ffd03c',
        intentPattern: [
            { kind: 'summonBlock', amount: 10, allyAmount: 6 },
            { kind: 'attack', amount: 12 },
            { kind: 'attackVuln', amount: 8, vuln: 2 },
            { kind: 'buffSelf', strength: 2 }
        ]
    },
    demonWarlock: {
        id: 'demonWarlock', name: 'Demon Warlock',
        hp: 70, isElite: true, spriteKey: 'beholder_1', accent: '#ff60a0',
        intentPattern: [
            { kind: 'drain', amount: 7, heal: 10 },
            { kind: 'multiAttack', amount: 5, hits: 2 },
            { kind: 'debuff', vuln: 3 }
        ]
    },

    /* Floor 3 boss — final ascended balor form */
    balorPrime: {
        id: 'balorPrime', name: 'Balor Prime',
        hp: 140, isBoss: true, spriteKey: 'balor_1', accent: '#ff3030',
        intentPattern: [
            { kind: 'attack', amount: 14 },
            { kind: 'multiAttack', amount: 5, hits: 3 },
            { kind: 'attackVuln', amount: 10, vuln: 2 },
            { kind: 'buffSelf', strength: 2 },
            { kind: 'block', amount: 18 },
            { kind: 'drain', amount: 8, heal: 8 }
        ]
    }
};

/*
 * Per-floor encounter pools. Each entry is an array of enemy ids that
 * spawn together as one fight — single-element arrays are 1v1 fights
 * and multi-element arrays are pack fights.
 */
export const FLOOR_ENCOUNTERS = {
    1: {
        normal: [['goblinScout'], ['skeleton'], ['beholder'], ['caveBat']],
        pack:   [['goblinScout', 'goblinScout'], ['caveBat', 'caveBat'], ['goblinScout', 'caveBat'], ['skeleton', 'caveBat']],
        elite:  [['goblinChieftain'], ['bogWraith']],
        boss:   [['wraithBoss']]
    },
    2: {
        normal: [['orcBrute'], ['zombie'], ['necroAcolyte'], ['skeleton', 'caveBat']],
        pack:   [['orcBrute', 'goblinScout'], ['zombie', 'zombie'], ['necroAcolyte', 'skeleton'], ['orcBrute', 'caveBat']],
        elite:  [['orcWarchief'], ['darkPriest']],
        boss:   [['balor']]
    },
    3: {
        normal: [['deathKnight'], ['shadowmancer'], ['iceTroll'], ['orcBrute', 'necroAcolyte']],
        pack:   [['shadowmancer', 'shadowmancer'], ['deathKnight', 'caveBat'], ['iceTroll', 'orcBrute'], ['zombie', 'zombie', 'caveBat']],
        elite:  [['skeleKing'], ['demonWarlock']],
        boss:   [['balorPrime']]
    }
};

export function getEnemy(id) {
    return ENEMY_LIBRARY[id] || null;
}

/*
 * Look up the encounter pool for a given floor (1..3) and node kind.
 * Returns an array of encounter arrays. Falls back to floor 1 if the
 * floor is unknown.
 */
export function getEncounterPool(floor, kind) {
    const f = FLOOR_ENCOUNTERS[floor] || FLOOR_ENCOUNTERS[1];
    return f[kind] || f.normal;
}

/*
 * Produce a plain English summary of an enemy intent for the UI tooltip.
 * Damage values shown here are pre-modifier (no Vulnerable / Strength
 * factored in) — the standard genre convention is to show the base
 * value the designer wrote on the card so the player can mentally plan
 * around the actual hit by accounting for their own active debuffs.
 */
export function describeIntent(intent) {
    if (!intent) return '...';
    switch (intent.kind) {
        case 'attack':       return `Attack ${intent.amount}`;
        case 'block':        return `Block ${intent.amount}`;
        case 'attackVuln':   return `Attack ${intent.amount} + Vuln ${intent.vuln}`;
        case 'debuff':       return `Vuln ${intent.vuln}`;
        case 'drain':        return `Drain ${intent.amount}`;
        case 'multiAttack':  return `Attack ${intent.amount}x${intent.hits}`;
        case 'buffSelf':     return `Strength +${intent.strength}`;
        case 'summonBlock':  return `Block ${intent.amount} (party)`;
        default:             return intent.kind;
    }
}

export function intentIcon(intent) {
    if (!intent) return '?';
    switch (intent.kind) {
        case 'attack':       return '⚔';
        case 'block':        return '🛡';
        case 'attackVuln':   return '☠';
        case 'debuff':       return '👁';
        case 'drain':        return '✦';
        case 'multiAttack':  return '⚔⚔';
        case 'buffSelf':     return '⬆';
        case 'summonBlock':  return '🛡✦';
        default:             return '?';
    }
}

/*
 * Project the displayed damage of an attack intent given the enemy's
 * current Strength buff and whether the player is Vulnerable. Mirrors
 * the engine's _dealDamageToPlayer math. Used by the UI to show
 * "incoming N damage" tooltips on intent badges.
 */
export function projectIntentDamage(intent, enemy, playerVulnerable) {
    if (!intent) return 0;
    const stren = (enemy && enemy.strength) || 0;
    const baseHits = (kind) => {
        if (kind === 'attack' || kind === 'attackVuln' || kind === 'drain') return 1;
        if (kind === 'multiAttack') return intent.hits || 1;
        return 0;
    };
    const hits = baseHits(intent.kind);
    if (hits === 0) return 0;
    let perHit = Math.max(0, (intent.amount || 0) + stren);
    if (playerVulnerable) perHit = Math.floor(perHit * 1.5);
    return perHit * hits;
}
