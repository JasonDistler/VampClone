/*
 * Character definitions. Each entry describes:
 *   - sprite & animation setup (directional Velorian vs single-anim others)
 *   - body size (collision footprint within the sprite frame)
 *   - base stats (hp, speed, magnet)
 *   - which weapon class to spawn as the starting weapon
 *   - starting RunState weapon config (damage / cooldown / etc.)
 *   - level-up unlock keys (which extra weapons appear in the upgrade pool)
 *
 * GameScene reads the chosen character from the Phaser registry and uses
 * this config to assemble Player + RunState + initial weapon.
 */

export const CHARACTERS = {
    velorian: {
        id: 'velorian',
        name: 'Sir Velorian',
        title: 'The Paladin',
        // Holy retribution: a small chance per hit to "smite" enemies,
        // burning them with golden flame. Lower base chance balances
        // his higher base damage from the greatsword.
        onHitStatus: { type: 'burn', chance: 0.18, durationMs: 1200, dps: 8 },
        weaponName: "Lion's Bane",
        description: "Sworn knight of the Order. Sweeping greatsword arcs cleave swarms in half.",
        accent: '#f5c54b',
        portraitKey: 'velorian_down_0',
        portraitScale: 3,
        sprite: {
            initialKey: 'velorian_down_0',
            directional: true,
            anims: {
                down: 'velorian_down_walk',
                up: 'velorian_up_walk',
                side: 'velorian_side_walk'
            }
        },
        body: { w: 10, h: 10, offsetX: 7, offsetY: 20 },
        shadowKey: 'shadow_med',
        baseStats: { maxHp: 100, speed: 140, magnet: 70 },
        startingWeapon: 'greatsword',
        startingWeaponConfig: {
            damage: 24,
            cooldownMs: 900,
            arcRadius: 56,
            sweepDurationMs: 240,
            arcTexture: 'sword_arc',
            arcTint: 0xffffff
        },
        auraUnlock: {
            name: 'AURA OF SANCTITY',
            description: 'NEW WEAPON\nA radiant zone burns nearby foes',
            texture: 'holy_aura',
            tint: 0xffffff,
            damage: 5,
            radius: 50,
            tickMs: 600
        },
        projectileUnlock: {
            name: 'DAGGERS OF AVALON',
            description: 'NEW WEAPON\nThrown daggers fly in your facing\nUp to 60 dmg per enemy, pierces 2',
            texture: 'dagger',
            tint: 0xffffff,
            damage: 60,
            speed: 240,
            cooldownMs: 1100,
            count: 1,
            pierce: 2,
            mode: 'facing',
            spreadRad: 0.39
        }
    },
    pyra: {
        id: 'pyra',
        name: 'Pyra Flameheart',
        title: 'The Flameborn',
        // Every hit ignites - Pyra's signature DoT keeps swarms melting
        // even after she's moved past them.
        onHitStatus: { type: 'burn', chance: 1.0, durationMs: 1800, dps: 14 },
        weaponName: 'Flameburst',
        description: "A spark of elemental fire given form. Erupts radial flame in all directions.",
        accent: '#ff8c1a',
        portraitKey: 'fire_elemental_0',
        portraitScale: 4,
        sprite: {
            initialKey: 'fire_elemental_0',
            directional: false,
            anims: { walk: 'fire_elemental_burn' }
        },
        body: { w: 10, h: 10, offsetX: 4, offsetY: 12 },
        shadowKey: 'shadow_med',
        baseStats: { maxHp: 85, speed: 155, magnet: 80 },
        startingWeapon: 'flameburst',
        startingWeaponConfig: {
            damage: 14,
            cooldownMs: 1100,
            count: 6,
            speed: 200,
            lifetimeMs: 700,
            pierce: 2,
            projectileTexture: 'fire_bolt',
            explosion: {
                damageMult: 2.0,
                radius: 26,
                tint: 0xff8c1a,
                texture: 'holy_aura'
            }
        },
        auraUnlock: {
            name: 'INFERNO TRAIL',
            description: 'NEW WEAPON\nA blazing ring scorches everything near you',
            texture: 'holy_aura',
            tint: 0xff7a18,
            damage: 7,
            radius: 56,
            tickMs: 480
        },
        projectileUnlock: {
            name: 'EMBER VOLLEY',
            description: 'NEW WEAPON\nFire bolts seek the nearest foes',
            texture: 'fire_bolt',
            tint: 0xff8c1a,
            damage: 22,
            speed: 280,
            cooldownMs: 950,
            count: 2,
            pierce: 2,
            mode: 'nearest',
            spreadRad: 0.5,
            explosion: {
                damageMult: 1.5,
                radius: 22,
                tint: 0xff8c1a,
                texture: 'holy_aura'
            }
        }
    },
    lyra: {
        id: 'lyra',
        name: 'Lyra Shadowmancer',
        title: 'The Shadow Witch',
        // Shock pin - briefly stuns + slows; pairs well with her
        // piercing shadow lances that can hit multiple enemies in
        // a row, leaving a chained line of frozen targets.
        onHitStatus: { type: 'shock', chance: 0.45, durationMs: 700, jumps: 2 },
        weaponName: 'Shadow Lance',
        description: "Channels umbral magic. Auto-targets the nearest foe with piercing shadow bolts.",
        accent: '#c08cff',
        portraitKey: 'shadowmancer_0',
        portraitScale: 3,
        sprite: {
            initialKey: 'shadowmancer_0',
            directional: false,
            anims: { walk: 'shadowmancer_float' }
        },
        body: { w: 10, h: 10, offsetX: 4, offsetY: 16 },
        shadowKey: 'shadow_med',
        baseStats: { maxHp: 80, speed: 145, magnet: 90 },
        startingWeapon: 'shadowlance',
        startingWeaponConfig: {
            damage: 20,
            cooldownMs: 750,
            speed: 320,
            lifetimeMs: 900,
            pierce: 2,
            projectileTexture: 'magic_bolt',
            explosion: {
                damageMult: 2.0,
                radius: 32,
                tint: 0xc08cff,
                texture: 'holy_aura'
            }
        },
        auraUnlock: {
            name: 'CURSE NIMBUS',
            description: 'NEW WEAPON\nA leeching nimbus drains nearby souls',
            texture: 'holy_aura',
            tint: 0xc08cff,
            damage: 6,
            radius: 54,
            tickMs: 540
        },
        projectileUnlock: {
            name: 'BONE SPREAD',
            description: 'NEW WEAPON\nA fan of bone shards in your facing',
            texture: 'bone',
            tint: 0xb88cff,
            damage: 16,
            speed: 260,
            cooldownMs: 1000,
            count: 3,
            pierce: 1,
            mode: 'facing',
            spreadRad: 0.7,
            explosion: {
                damageMult: 1.5,
                radius: 24,
                tint: 0xc08cff,
                texture: 'holy_aura'
            }
        }
    },
    borg: {
        id: 'borg',
        name: 'Borg Frostfist',
        title: 'The Frost Knight',
        // Heavy freeze - every Glacier Maul swing chills enemies,
        // halving their pursuit speed for 1s. Synergizes with his
        // slow swing rate by giving him kiting room.
        onHitStatus: { type: 'freeze', chance: 1.0, durationMs: 1000, slowFactor: 0.4 },
        weaponName: 'Glacier Maul',
        description: "Heir of giants. Slow, mighty arcs crush enemies with bone-shattering ice.",
        accent: '#7feaff',
        portraitKey: 'frost_giant_0',
        portraitScale: 3,
        sprite: {
            initialKey: 'frost_giant_0',
            directional: false,
            anims: { walk: 'frost_giant_walk' }
        },
        body: { w: 14, h: 14, offsetX: 7, offsetY: 18 },
        shadowKey: 'shadow_large',
        baseStats: { maxHp: 160, speed: 105, magnet: 60 },
        startingWeapon: 'icehammer',
        startingWeaponConfig: {
            damage: 40,
            cooldownMs: 1400,
            arcRadius: 72,
            sweepDurationMs: 320,
            arcTexture: 'sword_arc',
            arcTint: 0x9be0ff,
            knockback: 220
        },
        auraUnlock: {
            name: 'FROST NOVA',
            description: 'NEW WEAPON\nA glacial pulse shatters foes around you',
            texture: 'holy_aura',
            tint: 0x7feaff,
            damage: 9,
            radius: 60,
            tickMs: 700
        },
        projectileUnlock: {
            name: 'ICE SHARDS',
            description: 'NEW WEAPON\nA spread of ice shards in your facing',
            texture: 'ice_shard',
            tint: 0xc0e8ff,
            damage: 22,
            speed: 230,
            cooldownMs: 1200,
            count: 3,
            pierce: 1,
            mode: 'facing',
            spreadRad: 0.5,
            explosion: {
                damageMult: 1.6,
                radius: 28,
                tint: 0x9bdcff,
                texture: 'holy_aura'
            }
        }
    },
    /*
     * Ranger - meta-unlocked character. Reuses the Goblin Sniper sprite
     * + walk anim instead of bringing in fresh art. Plays as a fast,
     * fragile ranger with a daggers-style starting weapon themed as
     * arrows. Status effect = poison from envenomed arrows.
     */
    ranger: {
        id: 'ranger',
        name: 'Sylvi the Ranger',
        title: 'The Hunter',
        unlockId: 'char_ranger',
        onHitStatus: { type: 'poison', chance: 0.6, durationMs: 2400, dps: 6 },
        weaponName: 'Hunter Arrows',
        description: "Wood-elf marksman. Light on her feet, deadly at range. Arrows poison on hit.",
        accent: '#a8f070',
        portraitKey: 'goblin_sniper_0',
        portraitScale: 4,
        sprite: {
            initialKey: 'goblin_sniper_0',
            directional: false,
            anims: { walk: 'goblin_sniper_walk' }
        },
        body: { w: 8, h: 8, offsetX: 4, offsetY: 12 },
        shadowKey: 'shadow_med',
        baseStats: { maxHp: 75, speed: 170, magnet: 95 },
        startingWeapon: 'flameburst',  // reuse Flameburst class as the
        // arrow burster - direction-aware multishot is what we want
        // for a ranger and the existing class handles it cleanly.
        startingWeaponConfig: {
            damage: 16,
            cooldownMs: 700,
            count: 4,
            speed: 280,
            lifetimeMs: 800,
            pierce: 1,
            projectileTexture: 'arrow',
            projectileTint: 0xa8f070,
            spreadRad: 0.18
        },
        auraUnlock: {
            name: 'WOODLAND BOND',
            description: 'NEW WEAPON\nNature\'s pulse stings nearby foes',
            texture: 'holy_aura',
            tint: 0xa8f070,
            damage: 4,
            radius: 50,
            tickMs: 700
        },
        projectileUnlock: {
            name: 'TWIN HUNTERS',
            description: 'NEW WEAPON\nA second volley fires forward each rotation',
            texture: 'arrow',
            tint: 0xa8f070,
            damage: 26,
            speed: 280,
            cooldownMs: 1000,
            count: 2,
            pierce: 2,
            mode: 'facing',
            spreadRad: 0.3
        }
    },
    /*
     * Monk - meta-unlocked character. Tanky melee with chained shock
     * fists. Reuses the Goblin Berserker sprite/anim. Mechanically a
     * faster Velorian with shock instead of burn.
     */
    monk: {
        id: 'monk',
        name: 'Brother Renzo',
        title: 'The Iron Monk',
        unlockId: 'char_monk',
        onHitStatus: { type: 'shock', chance: 0.7, durationMs: 500, jumps: 1 },
        weaponName: 'Iron Fists',
        description: "A wandering ascetic with thunderous fists. Short reach, brutal cooldown.",
        accent: '#fff088',
        portraitKey: 'goblin_berserker_0',
        portraitScale: 4,
        sprite: {
            initialKey: 'goblin_berserker_0',
            directional: false,
            anims: { walk: 'goblin_berserker_walk' }
        },
        body: { w: 10, h: 10, offsetX: 4, offsetY: 14 },
        shadowKey: 'shadow_med',
        baseStats: { maxHp: 120, speed: 165, magnet: 70 },
        startingWeapon: 'greatsword',
        startingWeaponConfig: {
            damage: 16,
            cooldownMs: 460,  // very fast jab cadence
            arcRadius: 38,    // shorter reach than Velorian
            sweepDurationMs: 180,
            arcTexture: 'sword_arc',
            arcTint: 0xfff088
        },
        auraUnlock: {
            name: 'STORM CHANNEL',
            description: 'NEW WEAPON\nLightning crackles around your fists',
            texture: 'holy_aura',
            tint: 0xfff088,
            damage: 6,
            radius: 44,
            tickMs: 540
        },
        projectileUnlock: {
            name: 'CHI BURST',
            description: 'NEW WEAPON\nA spirit bolt flies in your facing direction',
            texture: 'magic_bolt',
            tint: 0xfff088,
            damage: 38,
            speed: 260,
            cooldownMs: 900,
            count: 1,
            pierce: 3,
            mode: 'facing',
            spreadRad: 0.0
        }
    }
};

export const CHARACTER_ORDER = ['velorian', 'pyra', 'lyra', 'borg', 'ranger', 'monk'];

export const REGISTRY_CHARACTER_KEY = 'selectedCharacter';
export const REGISTRY_DIFFICULTY_KEY = 'difficulty';

export function getCharacter(id) {
    return CHARACTERS[id] || CHARACTERS.velorian;
}
