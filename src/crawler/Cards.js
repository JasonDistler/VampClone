/*
 * Card library for Crawler Mode.
 *
 * Cards are pure data — every effect is expressed as a list of declarative
 * "actions" that the combat engine knows how to execute. This keeps the
 * card library testable, JSON-serializable, and easy to extend without
 * touching engine code: adding a new card means describing its actions,
 * not writing imperative effect functions.
 *
 * Action shapes (consumed by CombatEngine.applyAction):
 *
 *   { kind: 'damage',      amount: N }            single-target, +Str / x1.5 vs Vuln
 *   { kind: 'damageAll',   amount: N }            same modifiers, all enemies
 *   { kind: 'block',       amount: N }            +N to player Block
 *   { kind: 'draw',        amount: N }            draw N cards
 *   { kind: 'gainStrength', amount: N }           +N Strength rest of combat
 *   { kind: 'gainEnergy',  amount: N }            +N current-turn energy
 *   { kind: 'applyVulnerable',    amount: N }     N Vuln to target
 *   { kind: 'applyVulnerableAll', amount: N }     N Vuln to all enemies
 *   { kind: 'heal',        amount: N }            heal player N HP (capped at maxHp)
 *   { kind: 'multiAttack', amount: N, hits: M }   N damage M times to target
 *
 * The 'cost' is energy required to play. 'type' is purely cosmetic
 * frame color: 'attack' / 'skill' / 'power'.
 *
 * Upgrades:
 *   Each upgradable card has an `upgradedId` pointing to its `+` variant
 *   (also a card in this library, with `isUpgrade: true`). The engine
 *   swaps the card id in the run's deck when the player upgrades it at
 *   a rest site. Upgraded cards never themselves appear in the reward
 *   pool — they only enter the deck via upgrades.
 */

export const CARD_LIBRARY = {

    /* =========================================================
     *  Universal cards (every starter deck has access)
     * ========================================================= */

    slash: {
        id: 'slash', name: 'Slash', cost: 1, type: 'attack',
        text: 'Deal 6 damage.',
        actions: [{ kind: 'damage', amount: 6 }],
        upgradedId: 'slashPlus'
    },
    slashPlus: {
        id: 'slashPlus', name: 'Slash+', cost: 1, type: 'attack',
        text: 'Deal 9 damage.', isUpgrade: true,
        actions: [{ kind: 'damage', amount: 9 }]
    },

    cleave: {
        id: 'cleave', name: 'Cleave', cost: 2, type: 'attack',
        text: 'Deal 5 damage to ALL enemies.',
        actions: [{ kind: 'damageAll', amount: 5 }],
        upgradedId: 'cleavePlus'
    },
    cleavePlus: {
        id: 'cleavePlus', name: 'Cleave+', cost: 2, type: 'attack',
        text: 'Deal 8 damage to ALL enemies.', isUpgrade: true,
        actions: [{ kind: 'damageAll', amount: 8 }]
    },

    bash: {
        id: 'bash', name: 'Bash', cost: 1, type: 'attack',
        text: 'Deal 3 damage. Gain 2 Block.',
        actions: [{ kind: 'damage', amount: 3 }, { kind: 'block', amount: 2 }],
        upgradedId: 'bashPlus'
    },
    bashPlus: {
        id: 'bashPlus', name: 'Bash+', cost: 1, type: 'attack',
        text: 'Deal 5 damage. Gain 4 Block.', isUpgrade: true,
        actions: [{ kind: 'damage', amount: 5 }, { kind: 'block', amount: 4 }]
    },

    brace: {
        id: 'brace', name: 'Brace', cost: 1, type: 'skill',
        text: 'Gain 6 Block.',
        actions: [{ kind: 'block', amount: 6 }],
        upgradedId: 'bracePlus'
    },
    bracePlus: {
        id: 'bracePlus', name: 'Brace+', cost: 1, type: 'skill',
        text: 'Gain 9 Block.', isUpgrade: true,
        actions: [{ kind: 'block', amount: 9 }]
    },

    /* =========================================================
     *  Pyra — fire / damageAll specialist
     * ========================================================= */

    fireBolt: {
        id: 'fireBolt', name: 'Fire Bolt', cost: 1, type: 'attack',
        text: 'Deal 7 damage.',
        actions: [{ kind: 'damage', amount: 7 }],
        upgradedId: 'fireBoltPlus'
    },
    fireBoltPlus: {
        id: 'fireBoltPlus', name: 'Fire Bolt+', cost: 1, type: 'attack',
        text: 'Deal 10 damage.', isUpgrade: true,
        actions: [{ kind: 'damage', amount: 10 }]
    },

    flameWave: {
        id: 'flameWave', name: 'Flame Wave', cost: 2, type: 'attack',
        text: 'Deal 4 damage to ALL enemies. Apply 1 Vulnerable to all.',
        actions: [
            { kind: 'damageAll', amount: 4 },
            { kind: 'applyVulnerableAll', amount: 1 }
        ],
        upgradedId: 'flameWavePlus'
    },
    flameWavePlus: {
        id: 'flameWavePlus', name: 'Flame Wave+', cost: 2, type: 'attack',
        text: 'Deal 6 damage to ALL enemies. Apply 2 Vulnerable to all.', isUpgrade: true,
        actions: [
            { kind: 'damageAll', amount: 6 },
            { kind: 'applyVulnerableAll', amount: 2 }
        ]
    },

    sparkShield: {
        id: 'sparkShield', name: 'Spark Shield', cost: 1, type: 'skill',
        text: 'Gain 5 Block.',
        actions: [{ kind: 'block', amount: 5 }],
        upgradedId: 'sparkShieldPlus'
    },
    sparkShieldPlus: {
        id: 'sparkShieldPlus', name: 'Spark Shield+', cost: 1, type: 'skill',
        text: 'Gain 8 Block.', isUpgrade: true,
        actions: [{ kind: 'block', amount: 8 }]
    },

    /* =========================================================
     *  Lyra — shadow / debuff / draw
     * ========================================================= */

    shadowBolt: {
        id: 'shadowBolt', name: 'Shadow Bolt', cost: 1, type: 'attack',
        text: 'Deal 5 damage. Apply 1 Vulnerable.',
        actions: [
            { kind: 'damage', amount: 5 },
            { kind: 'applyVulnerable', amount: 1 }
        ],
        upgradedId: 'shadowBoltPlus'
    },
    shadowBoltPlus: {
        id: 'shadowBoltPlus', name: 'Shadow Bolt+', cost: 1, type: 'attack',
        text: 'Deal 7 damage. Apply 2 Vulnerable.', isUpgrade: true,
        actions: [
            { kind: 'damage', amount: 7 },
            { kind: 'applyVulnerable', amount: 2 }
        ]
    },

    hex: {
        id: 'hex', name: 'Hex', cost: 1, type: 'skill',
        text: 'Apply 2 Vulnerable.',
        actions: [{ kind: 'applyVulnerable', amount: 2 }],
        upgradedId: 'hexPlus'
    },
    hexPlus: {
        id: 'hexPlus', name: 'Hex+', cost: 0, type: 'skill',
        text: 'Apply 2 Vulnerable.', isUpgrade: true,
        actions: [{ kind: 'applyVulnerable', amount: 2 }]
    },

    arcaneInsight: {
        id: 'arcaneInsight', name: 'Arcane Insight', cost: 0, type: 'skill',
        text: 'Draw 2 cards.',
        actions: [{ kind: 'draw', amount: 2 }],
        upgradedId: 'arcaneInsightPlus'
    },
    arcaneInsightPlus: {
        id: 'arcaneInsightPlus', name: 'Arcane Insight+', cost: 0, type: 'skill',
        text: 'Draw 3 cards.', isUpgrade: true,
        actions: [{ kind: 'draw', amount: 3 }]
    },

    /* =========================================================
     *  Borg — frost / heavy block
     * ========================================================= */

    frostStrike: {
        id: 'frostStrike', name: 'Frost Strike', cost: 1, type: 'attack',
        text: 'Deal 4 damage. Gain 4 Block.',
        actions: [
            { kind: 'damage', amount: 4 },
            { kind: 'block', amount: 4 }
        ],
        upgradedId: 'frostStrikePlus'
    },
    frostStrikePlus: {
        id: 'frostStrikePlus', name: 'Frost Strike+', cost: 1, type: 'attack',
        text: 'Deal 6 damage. Gain 6 Block.', isUpgrade: true,
        actions: [
            { kind: 'damage', amount: 6 },
            { kind: 'block', amount: 6 }
        ]
    },

    iceWall: {
        id: 'iceWall', name: 'Ice Wall', cost: 1, type: 'skill',
        text: 'Gain 8 Block.',
        actions: [{ kind: 'block', amount: 8 }],
        upgradedId: 'iceWallPlus'
    },
    iceWallPlus: {
        id: 'iceWallPlus', name: 'Ice Wall+', cost: 1, type: 'skill',
        text: 'Gain 12 Block.', isUpgrade: true,
        actions: [{ kind: 'block', amount: 12 }]
    },

    /* =========================================================
     *  Ranger — precision multi-hit
     * ========================================================= */

    quickShot: {
        id: 'quickShot', name: 'Quick Shot', cost: 1, type: 'attack',
        text: 'Deal 3 damage twice.',
        actions: [{ kind: 'multiAttack', amount: 3, hits: 2 }],
        upgradedId: 'quickShotPlus'
    },
    quickShotPlus: {
        id: 'quickShotPlus', name: 'Quick Shot+', cost: 1, type: 'attack',
        text: 'Deal 4 damage twice.', isUpgrade: true,
        actions: [{ kind: 'multiAttack', amount: 4, hits: 2 }]
    },

    keenEye: {
        id: 'keenEye', name: 'Keen Eye', cost: 1, type: 'skill',
        text: 'Apply 1 Vulnerable. Draw 1 card.',
        actions: [
            { kind: 'applyVulnerable', amount: 1 },
            { kind: 'draw', amount: 1 }
        ],
        upgradedId: 'keenEyePlus'
    },
    keenEyePlus: {
        id: 'keenEyePlus', name: 'Keen Eye+', cost: 1, type: 'skill',
        text: 'Apply 2 Vulnerable. Draw 1 card.', isUpgrade: true,
        actions: [
            { kind: 'applyVulnerable', amount: 2 },
            { kind: 'draw', amount: 1 }
        ]
    },

    /* =========================================================
     *  Monk — low-cost combos / energy
     * ========================================================= */

    flurry: {
        id: 'flurry', name: 'Flurry', cost: 0, type: 'attack',
        text: 'Deal 2 damage.',
        actions: [{ kind: 'damage', amount: 2 }],
        upgradedId: 'flurryPlus'
    },
    flurryPlus: {
        id: 'flurryPlus', name: 'Flurry+', cost: 0, type: 'attack',
        text: 'Deal 3 damage.', isUpgrade: true,
        actions: [{ kind: 'damage', amount: 3 }]
    },

    centeredBreath: {
        id: 'centeredBreath', name: 'Centered Breath', cost: 0, type: 'skill',
        text: 'Gain 4 Block.',
        actions: [{ kind: 'block', amount: 4 }],
        upgradedId: 'centeredBreathPlus'
    },
    centeredBreathPlus: {
        id: 'centeredBreathPlus', name: 'Centered Breath+', cost: 0, type: 'skill',
        text: 'Gain 6 Block.', isUpgrade: true,
        actions: [{ kind: 'block', amount: 6 }]
    },

    /* =========================================================
     *  Reward pool (drawn after each non-boss fight)
     * ========================================================= */

    heavyStrike: {
        id: 'heavyStrike', name: 'Heavy Strike', cost: 2, type: 'attack',
        text: 'Deal 14 damage.',
        actions: [{ kind: 'damage', amount: 14 }],
        upgradedId: 'heavyStrikePlus'
    },
    heavyStrikePlus: {
        id: 'heavyStrikePlus', name: 'Heavy Strike+', cost: 2, type: 'attack',
        text: 'Deal 18 damage.', isUpgrade: true,
        actions: [{ kind: 'damage', amount: 18 }]
    },

    warBanner: {
        id: 'warBanner', name: 'War Banner', cost: 1, type: 'power',
        text: 'Gain 2 Strength for the rest of combat.',
        actions: [{ kind: 'gainStrength', amount: 2 }],
        upgradedId: 'warBannerPlus'
    },
    warBannerPlus: {
        id: 'warBannerPlus', name: 'War Banner+', cost: 1, type: 'power',
        text: 'Gain 3 Strength for the rest of combat.', isUpgrade: true,
        actions: [{ kind: 'gainStrength', amount: 3 }]
    },

    ironSkin: {
        id: 'ironSkin', name: 'Iron Skin', cost: 1, type: 'skill',
        text: 'Gain 5 Block. Draw 1 card.',
        actions: [{ kind: 'block', amount: 5 }, { kind: 'draw', amount: 1 }],
        upgradedId: 'ironSkinPlus'
    },
    ironSkinPlus: {
        id: 'ironSkinPlus', name: 'Iron Skin+', cost: 1, type: 'skill',
        text: 'Gain 8 Block. Draw 1 card.', isUpgrade: true,
        actions: [{ kind: 'block', amount: 8 }, { kind: 'draw', amount: 1 }]
    },

    whirlwind: {
        id: 'whirlwind', name: 'Whirlwind', cost: 3, type: 'attack',
        text: 'Deal 5 damage to ALL enemies twice.',
        actions: [
            { kind: 'damageAll', amount: 5 },
            { kind: 'damageAll', amount: 5 }
        ],
        upgradedId: 'whirlwindPlus'
    },
    whirlwindPlus: {
        id: 'whirlwindPlus', name: 'Whirlwind+', cost: 3, type: 'attack',
        text: 'Deal 7 damage to ALL enemies twice.', isUpgrade: true,
        actions: [
            { kind: 'damageAll', amount: 7 },
            { kind: 'damageAll', amount: 7 }
        ]
    },

    riposte: {
        id: 'riposte', name: 'Riposte', cost: 0, type: 'attack',
        text: 'Deal 3 damage. Gain 3 Block.',
        actions: [{ kind: 'damage', amount: 3 }, { kind: 'block', amount: 3 }],
        upgradedId: 'ripostePlus'
    },
    ripostePlus: {
        id: 'ripostePlus', name: 'Riposte+', cost: 0, type: 'attack',
        text: 'Deal 4 damage. Gain 4 Block.', isUpgrade: true,
        actions: [{ kind: 'damage', amount: 4 }, { kind: 'block', amount: 4 }]
    },

    battleCry: {
        id: 'battleCry', name: 'Battle Cry', cost: 1, type: 'skill',
        text: 'Draw 2 cards.',
        actions: [{ kind: 'draw', amount: 2 }],
        upgradedId: 'battleCryPlus'
    },
    battleCryPlus: {
        id: 'battleCryPlus', name: 'Battle Cry+', cost: 0, type: 'skill',
        text: 'Draw 2 cards.', isUpgrade: true,
        actions: [{ kind: 'draw', amount: 2 }]
    },

    secondWind: {
        id: 'secondWind', name: 'Second Wind', cost: 1, type: 'skill',
        text: 'Gain 6 Block. Heal 3 HP.',
        actions: [{ kind: 'block', amount: 6 }, { kind: 'heal', amount: 3 }],
        upgradedId: 'secondWindPlus'
    },
    secondWindPlus: {
        id: 'secondWindPlus', name: 'Second Wind+', cost: 1, type: 'skill',
        text: 'Gain 8 Block. Heal 5 HP.', isUpgrade: true,
        actions: [{ kind: 'block', amount: 8 }, { kind: 'heal', amount: 5 }]
    },

    daunt: {
        id: 'daunt', name: 'Daunt', cost: 1, type: 'skill',
        text: 'Apply 2 Vulnerable to ALL enemies.',
        actions: [{ kind: 'applyVulnerableAll', amount: 2 }],
        upgradedId: 'dauntPlus'
    },
    dauntPlus: {
        id: 'dauntPlus', name: 'Daunt+', cost: 1, type: 'skill',
        text: 'Apply 3 Vulnerable to ALL enemies.', isUpgrade: true,
        actions: [{ kind: 'applyVulnerableAll', amount: 3 }]
    },

    sunburst: {
        id: 'sunburst', name: 'Sunburst', cost: 2, type: 'attack',
        text: 'Deal 6 damage. Apply 1 Vulnerable.',
        actions: [
            { kind: 'damage', amount: 6 },
            { kind: 'applyVulnerable', amount: 1 }
        ],
        upgradedId: 'sunburstPlus'
    },
    sunburstPlus: {
        id: 'sunburstPlus', name: 'Sunburst+', cost: 2, type: 'attack',
        text: 'Deal 9 damage. Apply 2 Vulnerable.', isUpgrade: true,
        actions: [
            { kind: 'damage', amount: 9 },
            { kind: 'applyVulnerable', amount: 2 }
        ]
    },

    sweepingArc: {
        id: 'sweepingArc', name: 'Sweeping Arc', cost: 2, type: 'attack',
        text: 'Deal 7 damage to ALL enemies.',
        actions: [{ kind: 'damageAll', amount: 7 }],
        upgradedId: 'sweepingArcPlus'
    },
    sweepingArcPlus: {
        id: 'sweepingArcPlus', name: 'Sweeping Arc+', cost: 2, type: 'attack',
        text: 'Deal 10 damage to ALL enemies.', isUpgrade: true,
        actions: [{ kind: 'damageAll', amount: 10 }]
    },

    bulwark: {
        id: 'bulwark', name: 'Bulwark', cost: 2, type: 'skill',
        text: 'Gain 12 Block.',
        actions: [{ kind: 'block', amount: 12 }],
        upgradedId: 'bulwarkPlus'
    },
    bulwarkPlus: {
        id: 'bulwarkPlus', name: 'Bulwark+', cost: 2, type: 'skill',
        text: 'Gain 16 Block.', isUpgrade: true,
        actions: [{ kind: 'block', amount: 16 }]
    },

    holyAnthem: {
        id: 'holyAnthem', name: 'Holy Anthem', cost: 1, type: 'skill',
        text: 'Gain 1 Strength. Draw 1 card.',
        actions: [{ kind: 'gainStrength', amount: 1 }, { kind: 'draw', amount: 1 }],
        upgradedId: 'holyAnthemPlus'
    },
    holyAnthemPlus: {
        id: 'holyAnthemPlus', name: 'Holy Anthem+', cost: 1, type: 'skill',
        text: 'Gain 2 Strength. Draw 1 card.', isUpgrade: true,
        actions: [{ kind: 'gainStrength', amount: 2 }, { kind: 'draw', amount: 1 }]
    },

    rallyingShout: {
        id: 'rallyingShout', name: 'Rallying Shout', cost: 0, type: 'skill',
        text: 'Gain 2 Block. Draw 1 card.',
        actions: [{ kind: 'block', amount: 2 }, { kind: 'draw', amount: 1 }],
        upgradedId: 'rallyingShoutPlus'
    },
    rallyingShoutPlus: {
        id: 'rallyingShoutPlus', name: 'Rallying Shout+', cost: 0, type: 'skill',
        text: 'Gain 3 Block. Draw 1 card.', isUpgrade: true,
        actions: [{ kind: 'block', amount: 3 }, { kind: 'draw', amount: 1 }]
    },

    inspiringWord: {
        id: 'inspiringWord', name: 'Inspiring Word', cost: 1, type: 'skill',
        text: 'Gain 1 Energy. Draw 1 card.',
        actions: [{ kind: 'gainEnergy', amount: 1 }, { kind: 'draw', amount: 1 }],
        upgradedId: 'inspiringWordPlus'
    },
    inspiringWordPlus: {
        id: 'inspiringWordPlus', name: 'Inspiring Word+', cost: 0, type: 'skill',
        text: 'Gain 1 Energy. Draw 1 card.', isUpgrade: true,
        actions: [{ kind: 'gainEnergy', amount: 1 }, { kind: 'draw', amount: 1 }]
    },

    arrowVolley: {
        id: 'arrowVolley', name: 'Arrow Volley', cost: 2, type: 'attack',
        text: 'Deal 3 damage three times.',
        actions: [{ kind: 'multiAttack', amount: 3, hits: 3 }],
        upgradedId: 'arrowVolleyPlus'
    },
    arrowVolleyPlus: {
        id: 'arrowVolleyPlus', name: 'Arrow Volley+', cost: 2, type: 'attack',
        text: 'Deal 4 damage three times.', isUpgrade: true,
        actions: [{ kind: 'multiAttack', amount: 4, hits: 3 }]
    }
};

/*
 * Reward pool — universal cards offered after non-boss fights. Class-
 * specific cards are NOT in here; players bond with their starter
 * deck's identity and the reward pool extends it. (Future: rarity
 * weights and class-specific reward filtering.)
 */
export const REWARD_POOL = [
    'heavyStrike',
    'warBanner',
    'ironSkin',
    'whirlwind',
    'riposte',
    'battleCry',
    'secondWind',
    'daunt',
    'sunburst',
    'sweepingArc',
    'bulwark',
    'holyAnthem',
    'rallyingShout',
    'inspiringWord',
    'arrowVolley'
];

/*
 * Per-character starter decks. Each character gets a 10-card opening
 * deck themed to their class identity. Duplicates are intentional —
 * they shape early-game probabilities of drawing key cards.
 */
export const STARTER_DECKS = {
    velorian: [
        'slash', 'slash', 'slash', 'slash', 'slash',
        'cleave', 'cleave',
        'bash', 'bash',
        'brace'
    ],
    pyra: [
        'fireBolt', 'fireBolt', 'fireBolt', 'fireBolt',
        'flameWave', 'flameWave', 'flameWave',
        'sparkShield', 'sparkShield',
        'cleave'
    ],
    lyra: [
        'shadowBolt', 'shadowBolt', 'shadowBolt', 'shadowBolt',
        'hex', 'hex',
        'arcaneInsight', 'arcaneInsight',
        'brace', 'brace'
    ],
    borg: [
        'frostStrike', 'frostStrike', 'frostStrike', 'frostStrike',
        'iceWall', 'iceWall', 'iceWall',
        'bash', 'bash',
        'brace'
    ],
    ranger: [
        'quickShot', 'quickShot', 'quickShot', 'quickShot',
        'keenEye', 'keenEye',
        'slash', 'slash',
        'brace', 'brace'
    ],
    monk: [
        'flurry', 'flurry', 'flurry', 'flurry', 'flurry',
        'centeredBreath', 'centeredBreath', 'centeredBreath',
        'bash',
        'brace'
    ]
};

/*
 * Whether a card targets a single enemy (and therefore needs an explicit
 * target chosen) or auto-targets all enemies / the player. The combat
 * engine consults this when the player clicks a card.
 */
export function cardNeedsTarget(card) {
    if (!card || !card.actions) return false;
    return card.actions.some(
        (a) => a.kind === 'damage' || a.kind === 'multiAttack' || a.kind === 'applyVulnerable'
    );
}

export function getCard(id) {
    return CARD_LIBRARY[id] || null;
}

/*
 * Whether a card can be upgraded (not already upgraded and has a +
 * variant defined). Used by the rest-site upgrade picker to filter
 * the deck.
 */
export function isUpgradable(card) {
    if (!card) return false;
    if (card.isUpgrade) return false;
    return !!(card.upgradedId && CARD_LIBRARY[card.upgradedId]);
}

/*
 * Heuristic preview of a card's expected damage against the player's
 * current Strength and a hypothetical Vulnerable target. Returns null
 * if the card has no damage actions; otherwise returns
 * { perHit, hits, total, vulnerable } for the UI to render.
 */
export function previewDamage(card, strength = 0, targetVulnerable = false) {
    if (!card || !card.actions) return null;
    let perHit = 0;
    let hits = 0;
    for (const a of card.actions) {
        if (a.kind === 'damage') {
            perHit = Math.max(perHit, a.amount);
            hits = Math.max(hits, 1);
        } else if (a.kind === 'damageAll') {
            perHit = Math.max(perHit, a.amount);
            hits = Math.max(hits, 1);
        } else if (a.kind === 'multiAttack') {
            perHit = Math.max(perHit, a.amount);
            hits = Math.max(hits, a.hits || 1);
        }
    }
    if (hits === 0) return null;
    const buffed = Math.max(0, perHit + strength);
    const finalPerHit = targetVulnerable ? Math.floor(buffed * 1.5) : buffed;
    return {
        perHit: finalPerHit,
        hits,
        total: finalPerHit * hits,
        vulnerable: targetVulnerable
    };
}
