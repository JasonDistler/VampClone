/*
 * Shared run-time state. Stored on the Phaser game registry so every scene
 * (GameScene, UIScene, LevelUpScene, GameOverScene) sees the same object.
 *
 * The chosen character drives the *initial* values - base stats, the
 * starting weapon's config, etc. Aura and Daggers stay shared upgrade
 * unlocks across all heroes for now.
 */
export const REGISTRY_KEY = 'runState';

export function createRunState(character, difficulty = 'normal') {
    const stats = character.baseStats;
    const wpn = character.startingWeaponConfig;
    const aura = character.auraUnlock;
    const proj = character.projectileUnlock;

    return {
        characterId: character.id,
        weaponName: character.weaponName,
        difficulty,

        hp: stats.maxHp,
        maxHp: stats.maxHp,
        speed: stats.speed,
        magnet: stats.magnet,
        armor: 0,
        lifestealPct: 0,

        xp: 0,
        level: 1,
        xpToNext: xpForLevel(1),
        kills: 0,
        elapsedMs: 0,

        weapon: { ...wpn },

        aura: {
            active: false,
            name: aura.name,
            description: aura.description,
            texture: aura.texture,
            tint: aura.tint,
            damage: aura.damage,
            radius: aura.radius,
            tickMs: aura.tickMs
        },

        daggers: {
            active: false,
            name: proj.name,
            description: proj.description,
            texture: proj.texture,
            tint: proj.tint,
            damage: proj.damage,
            cooldownMs: proj.cooldownMs,
            speed: proj.speed,
            count: proj.count,
            pierce: proj.pierce,
            mode: proj.mode,
            spreadRad: proj.spreadRad,
            explosion: proj.explosion ? { ...proj.explosion } : null
        },

        /*
         * How many times each level-up card with a given id has been
         * applied this run. Used by the weapon/aura/daggers upgrade
         * caps in LevelUpScene: full power-up rolls for the first 6
         * picks of any single upgrade, then a soft "scrap" tier of
         * 2-3% from picks 7-10, then the upgrade is filtered out.
         */
        upgradeCounts: {},

        // Meta-progression damage multiplier applied when MetaProgress
        // unlocks are processed at run start. Default 1 so the math
        // doesn't change for runs without unlocks.
        metaDamageMult: 1.0,

        // Currency earned this run; cashed out at game-over via
        // metaProgress.finishRun().
        runGold: 0,

        // Run-flagged stats for achievements + run summary
        flawless: true,        // turned false on any HP loss
        damageByWeapon: {      // accumulated damage for end-of-run chart
            primary: 0,
            aura: 0,
            daggers: 0
        },
        elitesKilled: 0,
        chestsOpened: 0,
        bossesKilled: 0,

        // Run modifiers (set when starting via Daily / Curse)
        seed: null,            // when non-null, RNG is seeded for daily mode
        endlessMode: false,    // becomes true after 15:00 final boss
        scoreMult: 1.0,        // bumped by curses + endless
        curses: [],            // array of curse ids active

        gameOver: false
    };
}

export function xpForLevel(level) {
    return 5 + level * 4;
}

export function difficultyMultiplier(difficulty) {
    if (difficulty === 'easy') return { spawn: 0.75, damage: 0.8 };
    if (difficulty === 'hard') return { spawn: 1.35, damage: 1.25 };
    return { spawn: 1.0, damage: 1.0 };
}
