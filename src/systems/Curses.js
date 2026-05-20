/*
 * Pre-run curses. Each curse is an opt-in difficulty modifier that
 * (a) makes the run noticeably harder and (b) increases the run-gold
 * payout via runState.scoreMult. Curses stack additively: picking 3
 * curses each worth +35% gold gives +105% total.
 *
 * Apply hooks:
 *   apply(rs)   - mutates the freshly-built runState before gameplay
 *                 starts. Used to pre-multiply enemy damage, halve
 *                 player armor, double aggro radius, etc. The
 *                 SpawnDirector + Player systems read the resulting
 *                 fields without needing to know which curses are on.
 *
 * Stat fields that curses tune (added to runState here for clarity):
 *   rs.cursedEnemyHpMult     - extra mult for enemy HP rolls
 *   rs.cursedEnemyDmgMult    - extra mult for contact + projectile dmg
 *   rs.cursedSpawnMult       - extra mult on spawn cadence
 *   rs.cursedNoHearts        - hearts never spawn
 *   rs.cursedNoArmor         - rs.armor cannot exceed 0
 *
 * The MainMenuScene reads CURSES to render checkboxes and the GameScene
 * pulls the active list from the registry and applies them at start.
 */

export const CURSES = [
    {
        id: 'frenzy',
        name: 'Frenzy',
        desc: 'Enemies move 25% faster',
        scoreBonus: 0.20,
        apply: rs => { rs.cursedSpeedMult = (rs.cursedSpeedMult || 1) * 1.25; }
    },
    {
        id: 'famine',
        name: 'Famine',
        desc: 'Hearts never spawn',
        scoreBonus: 0.30,
        apply: rs => { rs.cursedNoHearts = true; }
    },
    {
        id: 'iron_will',
        name: 'Iron Will',
        desc: 'Enemies have +50% HP',
        scoreBonus: 0.25,
        apply: rs => { rs.cursedEnemyHpMult = (rs.cursedEnemyHpMult || 1) * 1.5; }
    },
    {
        id: 'sharp_fangs',
        name: 'Sharp Fangs',
        desc: 'Enemy damage +30%',
        scoreBonus: 0.25,
        apply: rs => { rs.cursedEnemyDmgMult = (rs.cursedEnemyDmgMult || 1) * 1.3; }
    },
    {
        id: 'horde',
        name: 'The Horde',
        desc: '+40% spawn rate',
        scoreBonus: 0.20,
        apply: rs => { rs.cursedSpawnMult = (rs.cursedSpawnMult || 1) * 1.4; }
    },
    {
        id: 'glass_cannon',
        name: 'Glass Cannon',
        desc: 'You take double damage',
        scoreBonus: 0.40,
        apply: rs => { rs.cursedPlayerDmgMult = (rs.cursedPlayerDmgMult || 1) * 2.0; }
    }
];

/*
 * Apply a list of curse ids to a freshly-built runState. Idempotent
 * for a given run - calling twice would double the effects, so caller
 * should call once at run start.
 */
export function applyCurses(rs, curseIds = []) {
    rs.curses = [...curseIds];
    let bonus = 0;
    for (const id of curseIds) {
        const c = CURSES.find(x => x.id === id);
        if (!c) continue;
        c.apply(rs);
        bonus += c.scoreBonus;
    }
    rs.scoreMult = (rs.scoreMult || 1.0) + bonus;
}
