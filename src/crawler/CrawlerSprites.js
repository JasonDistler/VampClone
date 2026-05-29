/*
 * Sprite key → painter function lookup for Crawler Mode.
 *
 * Every fighter portrait (player, enemy, elite, boss) renders by
 * looking up its `spriteKey` in this map and calling the painter to
 * produce a fresh canvas. The painters live in src/art/PixelArt.js.
 *
 * Frame 0 is the static "idle" frame; frame 1 is the action-pose
 * frame used for the intent telegraph (an enemy about to attack
 * shows its frame-1 pose; an enemy about to block stays on frame 0).
 *
 * Adding a new enemy or character = adding entries here for its
 * frame 0 (and frame 1 if you want the intent telegraph).
 */

import * as art from '../art/PixelArt.js';

export const SPRITE_PAINTERS = {
    /* ---------- Player characters ---------- */
    velorian_down_0:    () => art.paintVelorianDown(0),
    velorian_down_1:    () => art.paintVelorianDown(1),
    fire_elemental_0:   () => art.paintFireElemental(0),
    fire_elemental_1:   () => art.paintFireElemental(2),
    shadowmancer_0:     () => art.paintShadowmancer(0),
    shadowmancer_1:     () => art.paintShadowmancer(2),
    frost_giant_0:      () => art.paintFrostGiant(0),
    frost_giant_1:      () => art.paintFrostGiant(2),
    goblin_sniper_0:    () => art.paintGoblinSniper(0),
    goblin_sniper_1:    () => art.paintGoblinSniper(1),
    goblin_berserker_0: () => art.paintGoblinBerserker(0),
    goblin_berserker_1: () => art.paintGoblinBerserker(1),

    /* ---------- Enemy painters (frame 0 idle, frame 1 telegraph) ---------- */
    goblin_0:           () => art.paintGoblin(0),
    goblin_1:           () => art.paintGoblin(1),
    skeleton_0:         () => art.paintSkeleton(0),
    skeleton_1:         () => art.paintSkeleton(1),
    wraith_0:           () => art.paintWraith(0),
    wraith_1:           () => art.paintWraith(1),
    beholder_0:         () => art.paintBeholder(0),
    beholder_1:         () => art.paintBeholder(1),
    bat_0:              () => art.paintBat(0),
    bat_1:              () => art.paintBat(1),
    orcBrute_0:         () => art.paintOrcBrute(0),
    orcBrute_1:         () => art.paintOrcBrute(1),
    zombie_0:           () => art.paintZombie(0),
    zombie_1:           () => art.paintZombie(1),
    necrotech_0:        () => art.paintNecrotech(0),
    necrotech_1:        () => art.paintNecrotech(1),
    deathKnight_0:      () => art.paintDeathKnight(0),
    deathKnight_1:      () => art.paintDeathKnight(1),
    balor_0:            () => art.paintBalor(0),
    balor_1:            () => art.paintBalor(1),
    frostGiant_0:       () => art.paintFrostGiant(0),
    frostGiant_1:       () => art.paintFrostGiant(2)
};

export function paintSprite(spriteKey) {
    const fn = SPRITE_PAINTERS[spriteKey];
    return fn ? fn() : null;
}

/*
 * Pick a sprite key for an enemy based on its current intent. Enemies
 * about to attack / multi-attack / drain show their frame-1 pose;
 * defensive / debuff intents stay on frame 0. Returns the original
 * spriteKey unchanged if no frame-1 entry exists.
 */
export function spriteKeyForIntent(baseKey, intent) {
    if (!baseKey) return baseKey;
    if (!intent) return baseKey;
    const offensive = (
        intent.kind === 'attack' ||
        intent.kind === 'attackVuln' ||
        intent.kind === 'multiAttack' ||
        intent.kind === 'drain'
    );
    if (!offensive) return baseKey;
    /* baseKey ends with '_0'; swap to '_1' if a painter exists for it. */
    if (!baseKey.endsWith('_0')) return baseKey;
    const altKey = baseKey.slice(0, -2) + '_1';
    return SPRITE_PAINTERS[altKey] ? altKey : baseKey;
}
