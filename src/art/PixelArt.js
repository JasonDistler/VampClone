/*
 * Procedural pixel-art generator. Each `paintXxx` function draws a single
 * sprite frame to a fresh offscreen canvas. BootScene calls these and
 * registers the canvases as Phaser textures so the rest of the game can use
 * them like any other loaded asset.
 *
 * The drawing primitives intentionally stay tiny: `pixel`, `box`, `dot`. We
 * never use sub-pixel coordinates so everything snaps to a clean 32-bit grid.
 */

export const PALETTE = {
    // Sir Velorian
    plumeBright: '#ff5a3a',
    plumeMid: '#a52320',
    plumeDark: '#651212',
    plumeShade: '#3a0808',
    silverHi: '#f4f7fc',
    silverMid: '#9aa6b4',
    silverLo: '#525c6a',
    silverEdge: '#2a3340',
    silverGlint: '#ffffff',
    gold: '#f5c54b',
    goldHi: '#ffe486',
    goldDark: '#a9821e',
    goldEdge: '#5a4010',
    cloakRed: '#7a1a16',
    cloakHi: '#a52a22',
    cloakDark: '#4a0e0c',
    cloakEdge: '#2a0606',
    shieldBlue: '#3a5fa6',
    shieldBlueHi: '#5a86d2',
    shieldBlueDark: '#1d3267',
    shieldBlueEdge: '#0e1a3a',
    cyanGlow: '#7feaff',
    cyanGlowHi: '#cbf6ff',
    cyanGlowDark: '#3aaac4',
    leather: '#5a3a22',
    leatherHi: '#7a5234',
    leatherDark: '#3a2410',
    skin: '#d6a481',
    skinDark: '#9b6e4e',
    black: '#0a0a0a',

    // Goblin
    goblinSkin: '#6fb43a',
    goblinSkinShade: '#3d7218',
    goblinSkinHi: '#a8e070',
    goblinEye: '#ff2b2b',
    goblinLoin: '#5a3a22',
    goblinClaw: '#d6c6a8',

    // Skeleton
    boneHi: '#f4ecd8',
    boneMid: '#c9bfa3',
    boneLo: '#7a7058',
    shroud: '#3a3a4a',
    shroudDark: '#1d1d2a',
    eyeSocketGlow: '#5fc8ff',

    // Orc brute
    orcSkin: '#3f6f1c',
    orcSkinShade: '#22420f',
    orcSkinHi: '#6fa838',
    orcTusk: '#f0e6c0',
    orcArmor: '#4a2e1a',
    orcArmorMetal: '#7c7066',

    // Gems
    gemBlueHi: '#9bd6ff',
    gemBlue: '#3a8fd6',
    gemBlueLo: '#1d4f8a',
    gemGreenHi: '#a8f070',
    gemGreen: '#3da838',
    gemGreenLo: '#1d521e',
    gemGoldHi: '#fff0a0',
    gemGoldMid: '#f5c54b',
    gemGoldLo: '#a9821e',

    // Bat
    batBody: '#2a1d2e',
    batBodyDk: '#1a0d1e',
    batBodyHi: '#3a2d3e',

    // Zombie
    zombieFleshHi: '#7c8a4c',
    zombieFleshMid: '#4c5a2e',
    zombieFleshDk: '#2c3a1a',
    zombieEye: '#ffe848',
    blood: '#7a1a16',

    // Wraith
    shroudPurple: '#5a4a7a',
    shroudPurpleMid: '#3a2c5a',
    shroudPurpleDk: '#1d1d2a',
    wraithEye: '#5fc8ff',
    wraithEyeHi: '#9fe6ff',

    // Beholder
    beholderSkin: '#7c4c2e',
    beholderSkinDk: '#3a1c0e',
    beholderSkinHi: '#a86e48',
    eyeWhite: '#f0e6c0',
    eyeIris: '#3a8fd6',
    eyeIrisDk: '#1d3267',

    // Magic
    magicCore: '#7b1aff',
    magicHi: '#c08cff',
    magicLo: '#3a0a7c',

    // Aura
    auraHi: '#fff5b8',
    auraMid: '#f5c54b',
    auraLo: '#7a5a1a',

    // Fire (elemental, balor)
    fireWhite: '#ffffff',
    fireYellow: '#ffeb44',
    fireOrange: '#ff8800',
    fireRed: '#ff4400',
    fireDeep: '#c84800',
    fireSmoke: '#3a1a08',

    // Ice (frost giant)
    iceHi: '#ffffff',
    iceMid: '#7feaff',
    iceLo: '#3a8fc4',
    iceFlesh: '#a8c8e8',
    iceFleshShade: '#5a7a9a',
    iceFleshHi: '#dde8f5',

    // Demon (balor)
    demonSkin: '#9b2a18',
    demonSkinDk: '#5a1208',
    demonSkinHi: '#cf4a32',
    demonHorn: '#1a0a06',

    // Death knight + shadowmancer (deep purple/black)
    deathArmor: '#1a1424',
    deathArmorEdge: '#0a060a',
    deathGlow: '#9b3aff',
    deathGlowHi: '#c08cff',

    // Necrotech (rust + green)
    techMetal: '#4a3a2a',
    techMetalDk: '#2a1a0a',
    techMetalHi: '#7a6a5a',
    techRust: '#7a4422',
    techCore: '#00ff44',
    techCoreHi: '#aaffaa',

    // Ground
    cobbleHi: '#3e3850',
    cobbleMid: '#2c2738',
    cobbleLo: '#1a1624',
    cobbleEdge: '#0e0a18',
    grout: '#0a0814',

    // Forest (grass)
    grassHi: '#4a8a3a',
    grassMid: '#357024',
    grassLo: '#1f4a16',
    grassEdge: '#0e2010',
    bladeHi: '#7ec05a',
    earth: '#2a1c10',

    // Swamp (mud + water)
    mudHi: '#5a4828',
    mudMid: '#3a2c18',
    mudLo: '#1f1608',
    mudEdge: '#0c0804',
    swampWater: '#2a4030',
    swampWaterHi: '#3a6048',
    swampMoss: '#4a6a2a',

    // Library (wood floor + books + brass)
    woodHi: '#7a5230',
    woodMid: '#5a3a20',
    woodLo: '#3a2410',
    woodEdge: '#1a0e08',
    woodGrain: '#42301c',
    brass: '#c89030',
    brassHi: '#f0c060',
    brassDk: '#7a5818',
    bookA: '#8a2018',
    bookB: '#1a4070',
    bookC: '#2a6028',
    bookD: '#603a18',
    bookE: '#4a1a4a',
    bookSpine: '#0a0608',

    // Trees and rocks
    barkHi: '#6a4828',
    barkMid: '#4a3018',
    barkLo: '#2a1c08',
    barkEdge: '#150c04',
    leafHi: '#5a8a30',
    leafMid: '#357020',
    leafLo: '#1f4a16',
    leafEdge: '#0a1a08',
    deadBarkHi: '#5a4838',
    deadBarkMid: '#3a2c20',
    deadBarkLo: '#1c1408',
    rockHi: '#7a7080',
    rockMid: '#54506a',
    rockLo: '#322e44',
    rockEdge: '#161220',

    // Crate
    crateHi: '#a77640',
    crateMid: '#7a5230',
    crateLo: '#4a3018',
    crateEdge: '#1a0e08',
    crateBand: '#3a2410',

    // Candelabra
    candleWax: '#f4e8c0',
    candleWaxLo: '#a89858',
    flame: '#ffe06a',
    flameMid: '#ff9a30',
    flameDk: '#c84a18'
};

function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return { canvas: c, ctx };
}

function pixel(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
}

function box(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
}

function outlinedBox(ctx, x, y, w, h, fill, edge) {
    box(ctx, x, y, w, h, fill);
    box(ctx, x, y, w, 1, edge);
    box(ctx, x, y + h - 1, w, 1, edge);
    box(ctx, x, y, 1, h, edge);
    box(ctx, x + w - 1, y, 1, h, edge);
}

/* =========================================================================
 *  SIR VELORIAN
 *
 *  4-frame walk cycle per facing. Frame indices use the classic
 *  pixel-art "passing" convention:
 *
 *    0 = contact (left foot forward, right foot trailing - heel strike)
 *    1 = passing (right foot lifted, body slightly higher)
 *    2 = contact mirrored (right foot forward, left trailing)
 *    3 = passing mirrored (left foot lifted, body slightly higher)
 *
 *  This produces a smooth two-step gait that reads as actual walking
 *  rather than the old static-bobble two-frame cycle.
 *
 *  All directions also pick up:
 *   - Multi-tone plume with shaded base + bright tip
 *   - Gold trim accents on the helm + breastplate
 *   - Engraved cross emblem in raised gold
 *   - Etched pauldron rivets
 *   - Articulated knee greaves (visible bend during stride)
 *   - Sword's runic glow shifts position per frame to feel "alive"
 *   - Cape edge has a darker fringe + frame-driven sway
 * ========================================================================= */

const VELORIAN_W = 24;
const VELORIAN_H = 32;

/*
 * Per-frame pose offsets. Negative bodyBob = body slightly higher
 * (passing/airborne mid-stride). Frames 0/2 are contact frames where
 * both feet are planted - those have bodyBob 0. capeShift slides the
 * cape side-to-side a single pixel for natural fabric sway.
 */
const VELORIAN_POSE = [
    { bodyBob: 0,  legL: 0, legR: 0, swordBob: 0, capeShift: 0 },
    { bodyBob: -1, legL: -1, legR: 0, swordBob: -1, capeShift: 1 },
    { bodyBob: 0,  legL: 0, legR: 0, swordBob: 0, capeShift: 0 },
    { bodyBob: -1, legL: 0, legR: -1, swordBob: -1, capeShift: -1 }
];

/* Helm with shaded plume tip, riveted brow band, gold cheek-guards
 * and an inscribed gold cross at the forehead. Eye slit gets a
 * subtle cyan glint to match the sword's enchantment. */
function paintVelorianHelm(ctx, bob) {
    const yo = bob;

    // Plume - bright tip fading to dark base, with a shaded back-edge
    box(ctx, 10, 0 + yo, 4, 1, PALETTE.plumeBright);
    box(ctx, 9, 1 + yo, 6, 1, PALETTE.plumeBright);
    pixel(ctx, 14, 1 + yo, PALETTE.plumeShade);
    box(ctx, 9, 2 + yo, 6, 1, PALETTE.plumeMid);
    pixel(ctx, 14, 2 + yo, PALETTE.plumeShade);
    box(ctx, 10, 3 + yo, 4, 1, PALETTE.plumeMid);
    pixel(ctx, 11, 4 + yo, PALETTE.plumeDark);
    pixel(ctx, 12, 4 + yo, PALETTE.plumeDark);

    // Helm shell with a glint highlight on the upper-left
    outlinedBox(ctx, 7, 5 + yo, 10, 9, PALETTE.silverMid, PALETTE.silverEdge);
    box(ctx, 8, 6 + yo, 8, 6, PALETTE.silverHi);
    pixel(ctx, 8, 6 + yo, PALETTE.silverGlint);
    pixel(ctx, 9, 6 + yo, PALETTE.silverGlint);
    box(ctx, 8, 12 + yo, 8, 1, PALETTE.silverLo);

    // Brow band rivets - row of dots gives the helm a forged look
    pixel(ctx, 8, 5 + yo, PALETTE.goldDark);
    pixel(ctx, 11, 5 + yo, PALETTE.gold);
    pixel(ctx, 12, 5 + yo, PALETTE.gold);
    pixel(ctx, 15, 5 + yo, PALETTE.goldDark);

    // Gold cheek-guards
    pixel(ctx, 7, 9 + yo, PALETTE.gold);
    pixel(ctx, 7, 10 + yo, PALETTE.goldDark);
    pixel(ctx, 16, 9 + yo, PALETTE.gold);
    pixel(ctx, 16, 10 + yo, PALETTE.goldDark);

    // Eye slit + cyan glint
    box(ctx, 9, 9 + yo, 6, 1, PALETTE.black);
    pixel(ctx, 10, 9 + yo, PALETTE.cyanGlow);
    pixel(ctx, 13, 9 + yo, PALETTE.cyanGlow);

    // Inscribed cross emblem on forehead
    pixel(ctx, 11, 7 + yo, PALETTE.goldHi);
    pixel(ctx, 12, 7 + yo, PALETTE.goldHi);
    pixel(ctx, 11, 8 + yo, PALETTE.gold);
    pixel(ctx, 12, 8 + yo, PALETTE.gold);
    pixel(ctx, 11, 6 + yo, PALETTE.goldDark);
    pixel(ctx, 12, 6 + yo, PALETTE.goldDark);

    // Gorget under the helm
    box(ctx, 8, 13 + yo, 8, 1, PALETTE.silverLo);
    box(ctx, 8, 14 + yo, 8, 1, PALETTE.silverEdge);
}

/*
 * Trunk + pauldrons + breastplate. legL/legR control vertical lift
 * for each foot independently so we can do passing strides instead of
 * the old "both legs slide together" wiggle.
 */
function paintVelorianBody(ctx, pose) {
    const { bodyBob, legL, legR, capeShift } = pose;
    const cy = 14 + bodyBob; // chest top y

    // Cape behind the armor, with sway based on frame
    const cs = capeShift;
    box(ctx, 4 + cs, cy, 16, 13, PALETTE.cloakRed);
    box(ctx, 4 + cs, cy, 1, 13, PALETTE.cloakDark);
    box(ctx, 19 + cs, cy, 1, 13, PALETTE.cloakDark);
    box(ctx, 4 + cs, cy + 12, 16, 1, PALETTE.cloakEdge);
    // Mid-tone fold lines and dark fold creases
    pixel(ctx, 6 + cs, cy + 4, PALETTE.cloakHi);
    pixel(ctx, 17 + cs, cy + 4, PALETTE.cloakHi);
    pixel(ctx, 6 + cs, cy + 7, PALETTE.cloakDark);
    pixel(ctx, 17 + cs, cy + 7, PALETTE.cloakDark);
    pixel(ctx, 5 + cs, cy + 10, PALETTE.cloakDark);
    pixel(ctx, 18 + cs, cy + 10, PALETTE.cloakDark);

    // Pauldrons (rounded shoulder caps)
    outlinedBox(ctx, 4, cy, 4, 4, PALETTE.silverMid, PALETTE.silverEdge);
    outlinedBox(ctx, 16, cy, 4, 4, PALETTE.silverMid, PALETTE.silverEdge);
    pixel(ctx, 5, cy + 1, PALETTE.silverHi);
    pixel(ctx, 17, cy + 1, PALETTE.silverHi);
    pixel(ctx, 5, cy + 3, PALETTE.silverEdge);
    pixel(ctx, 18, cy + 3, PALETTE.silverEdge);
    // Pauldron rivets
    pixel(ctx, 4, cy + 1, PALETTE.gold);
    pixel(ctx, 19, cy + 1, PALETTE.gold);

    // Breastplate
    outlinedBox(ctx, 6, cy, 12, 11, PALETTE.silverMid, PALETTE.silverEdge);
    box(ctx, 7, cy + 1, 10, 9, PALETTE.silverHi);
    box(ctx, 7, cy + 9, 10, 1, PALETTE.silverLo);
    pixel(ctx, 7, cy + 1, PALETTE.silverGlint);
    pixel(ctx, 8, cy + 1, PALETTE.silverGlint);

    // Engraved cross emblem (raised gold)
    box(ctx, 11, cy + 2, 2, 7, PALETTE.gold);
    box(ctx, 9, cy + 4, 6, 2, PALETTE.gold);
    pixel(ctx, 11, cy + 2, PALETTE.goldHi);
    pixel(ctx, 9, cy + 4, PALETTE.goldHi);
    pixel(ctx, 11, cy + 8, PALETTE.goldDark);
    pixel(ctx, 14, cy + 5, PALETTE.goldDark);
    // Inset gem at intersection
    pixel(ctx, 12, cy + 5, PALETTE.cyanGlowHi);
    pixel(ctx, 12, cy + 4, PALETTE.cyanGlow);

    // Belt with buckle
    box(ctx, 6, cy + 11, 12, 1, PALETTE.leather);
    box(ctx, 6, cy + 12, 12, 1, PALETTE.leatherDark);
    box(ctx, 11, cy + 11, 2, 1, PALETTE.gold);
    pixel(ctx, 11, cy + 11, PALETTE.goldHi);
    pixel(ctx, 12, cy + 12, PALETTE.goldDark);

    // Cuisses (thigh plates) under the belt
    box(ctx, 8, cy + 13, 3, 3, PALETTE.silverMid);
    box(ctx, 13, cy + 13, 3, 3, PALETTE.silverMid);
    pixel(ctx, 8, cy + 13, PALETTE.silverEdge);
    pixel(ctx, 15, cy + 13, PALETTE.silverEdge);
    pixel(ctx, 9, cy + 14, PALETTE.silverHi);
    pixel(ctx, 14, cy + 14, PALETTE.silverHi);

    // Knee greaves (articulated, lift independently per leg)
    const baseLegY = cy + 16;
    box(ctx, 8, baseLegY + legL, 3, 3, PALETTE.silverLo);
    box(ctx, 13, baseLegY + legR, 3, 3, PALETTE.silverLo);
    pixel(ctx, 9, baseLegY + 1 + legL, PALETTE.silverHi);
    pixel(ctx, 14, baseLegY + 1 + legR, PALETTE.silverHi);
    // Boots
    box(ctx, 7, baseLegY + 3 + legL, 4, 1, PALETTE.black);
    box(ctx, 12, baseLegY + 3 + legR, 4, 1, PALETTE.black);
    pixel(ctx, 7, baseLegY + 3 + legL, PALETTE.leatherDark);
    pixel(ctx, 15, baseLegY + 3 + legR, PALETTE.leatherDark);
}

/*
 * Heater shield with raised gold cross, riveted edge, and a tiny
 * cyan gem at the cross intersection so it matches the sword glow.
 */
function paintVelorianShield(ctx, sx, pose) {
    const x = sx;
    const y = 14 + pose.bodyBob;
    outlinedBox(ctx, x, y, 6, 9, PALETTE.shieldBlue, PALETTE.shieldBlueEdge);
    // Inner highlight
    box(ctx, x + 1, y + 1, 4, 2, PALETTE.shieldBlueHi);
    pixel(ctx, x + 1, y + 1, PALETTE.silverGlint);
    // Bottom shadow
    box(ctx, x + 1, y + 7, 4, 1, PALETTE.shieldBlueDark);

    // Raised gold cross
    box(ctx, x + 2, y + 2, 2, 5, PALETTE.gold);
    box(ctx, x + 1, y + 4, 4, 1, PALETTE.gold);
    pixel(ctx, x + 2, y + 2, PALETTE.goldHi);
    pixel(ctx, x + 1, y + 4, PALETTE.goldHi);
    pixel(ctx, x + 3, y + 6, PALETTE.goldDark);
    pixel(ctx, x + 4, y + 4, PALETTE.goldDark);
    // Center gem
    pixel(ctx, x + 3, y + 4, PALETTE.cyanGlowHi);

    // Edge rivets
    pixel(ctx, x, y + 1, PALETTE.silverHi);
    pixel(ctx, x + 5, y + 1, PALETTE.silverHi);
    pixel(ctx, x, y + 7, PALETTE.silverHi);
    pixel(ctx, x + 5, y + 7, PALETTE.silverHi);
}

/*
 * Greatsword - polished blade with a runic blue glow that traces a
 * slightly different position each frame so the enchant looks alive.
 */
function paintVelorianSword(ctx, sx, sy, pose) {
    const offset = pose.swordBob;
    // Two-tone blade
    box(ctx, sx, sy + offset, 1, 9, PALETTE.silverHi);
    box(ctx, sx + 1, sy + offset, 1, 9, PALETTE.silverMid);
    pixel(ctx, sx, sy + offset, PALETTE.silverGlint);

    // Runic glow - travels along the blade per frame
    const glowSpot = (Math.abs(offset) + 2) % 8;
    pixel(ctx, sx, sy + glowSpot + offset, PALETTE.cyanGlowHi);
    pixel(ctx, sx + 1, sy + glowSpot + 1 + offset, PALETTE.cyanGlow);
    pixel(ctx, sx, sy + glowSpot + 3 + offset, PALETTE.cyanGlowDark);

    // Crossguard
    box(ctx, sx - 2, sy + 9 + offset, 6, 1, PALETTE.gold);
    pixel(ctx, sx - 2, sy + 9 + offset, PALETTE.goldDark);
    pixel(ctx, sx + 3, sy + 9 + offset, PALETTE.goldDark);
    pixel(ctx, sx, sy + 9 + offset, PALETTE.goldHi);

    // Pommel & wrapped grip
    pixel(ctx, sx, sy + 10 + offset, PALETTE.leather);
    pixel(ctx, sx + 1, sy + 10 + offset, PALETTE.leatherDark);
    pixel(ctx, sx, sy + 11 + offset, PALETTE.gold);
    pixel(ctx, sx + 1, sy + 11 + offset, PALETTE.goldDark);
}

export function paintVelorianDown(frame) {
    const { canvas, ctx } = makeCanvas(VELORIAN_W, VELORIAN_H);
    const pose = VELORIAN_POSE[frame] || VELORIAN_POSE[0];
    paintVelorianHelm(ctx, pose.bodyBob);
    paintVelorianBody(ctx, pose);
    paintVelorianShield(ctx, 1, pose);
    paintVelorianSword(ctx, 18, 14, pose);
    return canvas;
}

export function paintVelorianUp(frame) {
    const { canvas, ctx } = makeCanvas(VELORIAN_W, VELORIAN_H);
    const pose = VELORIAN_POSE[frame] || VELORIAN_POSE[0];
    const yo = pose.bodyBob;

    // Plume - viewed from behind, so the bright tip points away. Add
    // a darker rear silhouette for a subtle 3D feel.
    box(ctx, 10, 0 + yo, 4, 1, PALETTE.plumeMid);
    box(ctx, 9, 1 + yo, 6, 1, PALETTE.plumeMid);
    box(ctx, 9, 2 + yo, 6, 1, PALETTE.plumeDark);
    box(ctx, 10, 3 + yo, 4, 1, PALETTE.plumeDark);
    pixel(ctx, 11, 4 + yo, PALETTE.plumeShade);
    pixel(ctx, 12, 4 + yo, PALETTE.plumeShade);

    // Helm rear
    outlinedBox(ctx, 7, 5 + yo, 10, 9, PALETTE.silverMid, PALETTE.silverEdge);
    box(ctx, 8, 6 + yo, 8, 5, PALETTE.silverHi);
    box(ctx, 8, 11 + yo, 8, 2, PALETTE.silverLo);
    box(ctx, 8, 13 + yo, 8, 1, PALETTE.silverEdge);
    // Strap from helm into gorget
    pixel(ctx, 9, 12 + yo, PALETTE.leather);
    pixel(ctx, 14, 12 + yo, PALETTE.leather);

    // Cape - full back panel with vertical fold lines + sway
    const cs = pose.capeShift;
    const capeY = 14 + yo;
    box(ctx, 4 + cs, capeY, 16, 14, PALETTE.cloakRed);
    box(ctx, 4 + cs, capeY, 16, 1, PALETTE.cloakHi);
    box(ctx, 4 + cs, capeY, 1, 14, PALETTE.cloakDark);
    box(ctx, 19 + cs, capeY, 1, 14, PALETTE.cloakDark);
    box(ctx, 4 + cs, capeY + 13, 16, 1, PALETTE.cloakEdge);
    for (let yy = capeY + 2; yy < capeY + 13; yy += 3) {
        pixel(ctx, 8 + cs, yy, PALETTE.cloakDark);
        pixel(ctx, 11 + cs, yy, PALETTE.cloakDark);
        pixel(ctx, 15 + cs, yy, PALETTE.cloakDark);
    }
    // Cape clasp (pair of gold pins at shoulder line)
    pixel(ctx, 7 + cs, capeY + 1, PALETTE.gold);
    pixel(ctx, 16 + cs, capeY + 1, PALETTE.gold);

    // Backplate detail peeking out at top of cape
    box(ctx, 8, capeY, 8, 1, PALETTE.silverHi);
    pixel(ctx, 11, capeY, PALETTE.gold);
    pixel(ctx, 12, capeY, PALETTE.gold);

    // Boots
    const baseLegY = capeY + 14;
    box(ctx, 8, baseLegY + pose.legL, 3, 3, PALETTE.silverMid);
    box(ctx, 13, baseLegY + pose.legR, 3, 3, PALETTE.silverMid);
    pixel(ctx, 8, baseLegY + pose.legL, PALETTE.silverEdge);
    pixel(ctx, 15, baseLegY + pose.legR, PALETTE.silverEdge);
    box(ctx, 8, baseLegY + 2 + pose.legL, 3, 1, PALETTE.black);
    box(ctx, 13, baseLegY + 2 + pose.legR, 3, 1, PALETTE.black);

    return canvas;
}

export function paintVelorianSide(frame) {
    const { canvas, ctx } = makeCanvas(VELORIAN_W, VELORIAN_H);
    const pose = VELORIAN_POSE[frame] || VELORIAN_POSE[0];
    const yo = pose.bodyBob;

    // Plume - side profile, leaning into motion
    box(ctx, 11, 0 + yo, 3, 1, PALETTE.plumeBright);
    box(ctx, 10, 1 + yo, 5, 1, PALETTE.plumeBright);
    box(ctx, 10, 2 + yo, 5, 1, PALETTE.plumeMid);
    pixel(ctx, 14, 2 + yo, PALETTE.plumeShade);
    box(ctx, 11, 3 + yo, 4, 1, PALETTE.plumeDark);

    // Helm in profile
    outlinedBox(ctx, 8, 5 + yo, 9, 9, PALETTE.silverMid, PALETTE.silverEdge);
    box(ctx, 9, 6 + yo, 7, 6, PALETTE.silverHi);
    pixel(ctx, 9, 6 + yo, PALETTE.silverGlint);
    box(ctx, 9, 12 + yo, 7, 1, PALETTE.silverLo);
    // Visor slit + glint (only one eye visible from the side)
    box(ctx, 13, 9 + yo, 3, 1, PALETTE.black);
    pixel(ctx, 14, 9 + yo, PALETTE.cyanGlow);
    // Cheek guard
    pixel(ctx, 16, 10 + yo, PALETTE.gold);
    pixel(ctx, 16, 11 + yo, PALETTE.goldDark);

    // Cape behind, with sway shifted for profile view
    const cs = pose.capeShift;
    const capeX = 5 + cs;
    box(ctx, capeX, 14 + yo, 12, 13, PALETTE.cloakRed);
    box(ctx, capeX, 14 + yo, 1, 13, PALETTE.cloakDark);
    box(ctx, capeX, 26 + yo, 12, 1, PALETTE.cloakEdge);
    pixel(ctx, capeX + 3, 18 + yo, PALETTE.cloakHi);
    pixel(ctx, capeX + 8, 17 + yo, PALETTE.cloakDark);
    pixel(ctx, capeX + 2, 22 + yo, PALETTE.cloakDark);
    pixel(ctx, capeX + 7, 23 + yo, PALETTE.cloakDark);

    // Trunk - breastplate side
    outlinedBox(ctx, 9, 14 + yo, 8, 11, PALETTE.silverMid, PALETTE.silverEdge);
    box(ctx, 10, 15 + yo, 6, 9, PALETTE.silverHi);
    pixel(ctx, 10, 15 + yo, PALETTE.silverGlint);

    // Profile cross emblem (just vertical bar visible from side)
    box(ctx, 12, 17 + yo, 2, 6, PALETTE.gold);
    pixel(ctx, 12, 17 + yo, PALETTE.goldHi);
    pixel(ctx, 13, 22 + yo, PALETTE.goldDark);
    pixel(ctx, 12, 19 + yo, PALETTE.cyanGlowHi);

    // Pauldron (visible shoulder)
    box(ctx, 9, 14 + yo, 4, 3, PALETTE.silverLo);
    pixel(ctx, 10, 14 + yo, PALETTE.silverHi);
    pixel(ctx, 12, 14 + yo, PALETTE.silverHi);
    pixel(ctx, 9, 14 + yo, PALETTE.silverEdge);

    // Shield strapped to off-arm (front)
    outlinedBox(ctx, 4, 15 + yo, 5, 8, PALETTE.shieldBlue, PALETTE.shieldBlueEdge);
    box(ctx, 5, 16 + yo, 3, 1, PALETTE.shieldBlueHi);
    pixel(ctx, 5, 16 + yo, PALETTE.silverGlint);
    box(ctx, 5, 17 + yo, 3, 4, PALETTE.shieldBlueHi);
    box(ctx, 5, 21 + yo, 3, 1, PALETTE.shieldBlueDark);
    box(ctx, 5, 18 + yo, 3, 1, PALETTE.gold);
    box(ctx, 6, 16 + yo, 1, 5, PALETTE.gold);
    pixel(ctx, 6, 18 + yo, PALETTE.cyanGlowHi);

    // Greatsword held outward (sword arm)
    const swordOffset = pose.swordBob;
    box(ctx, 18, 5 + swordOffset, 1, 8, PALETTE.silverHi);
    box(ctx, 19, 5 + swordOffset, 1, 8, PALETTE.silverMid);
    pixel(ctx, 18, 5 + swordOffset, PALETTE.silverGlint);
    pixel(ctx, 18, 7 + swordOffset, PALETTE.cyanGlowHi);
    pixel(ctx, 19, 9 + swordOffset, PALETTE.cyanGlow);
    pixel(ctx, 18, 11 + swordOffset, PALETTE.cyanGlowDark);
    box(ctx, 17, 13 + swordOffset, 4, 1, PALETTE.gold);
    pixel(ctx, 17, 13 + swordOffset, PALETTE.goldDark);
    pixel(ctx, 20, 13 + swordOffset, PALETTE.goldDark);
    pixel(ctx, 18, 14 + swordOffset, PALETTE.goldHi);
    pixel(ctx, 19, 14 + swordOffset, PALETTE.leather);

    // Belt with buckle (profile)
    box(ctx, 9, 24 + yo, 8, 1, PALETTE.leather);
    box(ctx, 9, 25 + yo, 8, 1, PALETTE.leatherDark);
    pixel(ctx, 13, 24 + yo, PALETTE.gold);
    pixel(ctx, 13, 25 + yo, PALETTE.goldDark);

    // Legs - profile shows one foot leading. legL = lifted forward leg,
    // legR = trailing planted leg.
    const legY = 26 + yo;
    box(ctx, 9, legY + pose.legL, 3, 4, PALETTE.silverMid);
    box(ctx, 13, legY + pose.legR, 3, 4, PALETTE.silverMid);
    pixel(ctx, 9, legY + pose.legL, PALETTE.silverEdge);
    pixel(ctx, 13, legY + pose.legR, PALETTE.silverEdge);
    box(ctx, 9, legY + 4 + pose.legL, 4, 2, PALETTE.black);
    box(ctx, 13, legY + 4 + pose.legR, 4, 2, PALETTE.black);
    pixel(ctx, 9, legY + 4 + pose.legL, PALETTE.leatherDark);
    pixel(ctx, 16, legY + 4 + pose.legR, PALETTE.leatherDark);

    return canvas;
}

/* =========================================================================
 *  GOBLIN
 * ========================================================================= */

export function paintGoblin(frame) {
    const W = 16, H = 18;
    const { canvas, ctx } = makeCanvas(W, H);
    const stepY = frame === 0 ? 0 : -1;

    box(ctx, 5, 0, 6, 1, PALETTE.goblinSkin);
    box(ctx, 4, 1, 8, 5, PALETTE.goblinSkin);
    box(ctx, 4, 1, 1, 5, PALETTE.goblinSkinShade);
    box(ctx, 11, 1, 1, 5, PALETTE.goblinSkinShade);
    box(ctx, 5, 1, 6, 1, PALETTE.goblinSkinHi);

    box(ctx, 2, 3, 2, 4, PALETTE.goblinSkin);
    pixel(ctx, 2, 3, PALETTE.goblinSkinShade);
    pixel(ctx, 3, 6, PALETTE.goblinSkinShade);
    box(ctx, 12, 3, 2, 4, PALETTE.goblinSkin);
    pixel(ctx, 13, 3, PALETTE.goblinSkinShade);
    pixel(ctx, 12, 6, PALETTE.goblinSkinShade);

    pixel(ctx, 6, 3, PALETTE.goblinEye);
    pixel(ctx, 9, 3, PALETTE.goblinEye);
    pixel(ctx, 6, 4, '#7a0c0c');
    pixel(ctx, 9, 4, '#7a0c0c');

    box(ctx, 7, 5, 2, 1, PALETTE.goblinSkinShade);

    box(ctx, 5, 6, 6, 5, PALETTE.goblinSkin);
    box(ctx, 5, 6, 1, 5, PALETTE.goblinSkinShade);
    box(ctx, 10, 6, 1, 5, PALETTE.goblinSkinShade);
    box(ctx, 5, 11, 6, 2, PALETTE.goblinLoin);
    box(ctx, 5, 11, 6, 1, PALETTE.leatherDark);

    box(ctx, 3, 7, 2, 4, PALETTE.goblinSkin);
    pixel(ctx, 3, 7, PALETTE.goblinSkinShade);
    box(ctx, 11, 7, 2, 4, PALETTE.goblinSkin);
    pixel(ctx, 12, 7, PALETTE.goblinSkinShade);

    box(ctx, 1, 8, 2, 1, PALETTE.silverHi);
    box(ctx, 1, 9, 2, 1, PALETTE.silverMid);
    pixel(ctx, 0, 10, PALETTE.leather);

    box(ctx, 5, 13 + stepY, 2, 4, PALETTE.goblinSkin);
    box(ctx, 9, 13 - stepY, 2, 4, PALETTE.goblinSkin);
    pixel(ctx, 5, 13 + stepY, PALETTE.goblinSkinShade);
    pixel(ctx, 10, 13 - stepY, PALETTE.goblinSkinShade);
    box(ctx, 4, 16 + stepY, 3, 1, PALETTE.black);
    box(ctx, 9, 16 - stepY, 3, 1, PALETTE.black);

    return canvas;
}

/* =========================================================================
 *  SKELETON
 * ========================================================================= */

export function paintSkeleton(frame) {
    const W = 16, H = 22;
    const { canvas, ctx } = makeCanvas(W, H);
    const sway = frame === 0 ? 0 : 1;

    box(ctx, 5 + sway, 0, 6, 6, PALETTE.boneHi);
    box(ctx, 5 + sway, 0, 6, 1, PALETTE.boneLo);
    box(ctx, 5 + sway, 5, 6, 1, PALETTE.boneLo);
    box(ctx, 5 + sway, 0, 1, 6, PALETTE.boneMid);
    box(ctx, 10 + sway, 0, 1, 6, PALETTE.boneMid);

    box(ctx, 6 + sway, 2, 2, 2, PALETTE.shroudDark);
    box(ctx, 9 + sway, 2, 2, 2, PALETTE.shroudDark);
    pixel(ctx, 6 + sway, 2, PALETTE.eyeSocketGlow);
    pixel(ctx, 10 + sway, 2, PALETTE.eyeSocketGlow);

    box(ctx, 7 + sway, 4, 1, 1, PALETTE.boneLo);
    box(ctx, 9 + sway, 4, 1, 1, PALETTE.boneLo);
    box(ctx, 8 + sway, 5, 1, 1, PALETTE.boneLo);

    box(ctx, 7 + sway, 6, 3, 1, PALETTE.boneMid);
    box(ctx, 6 + sway, 7, 5, 1, PALETTE.boneHi);
    box(ctx, 6 + sway, 8, 5, 1, PALETTE.boneLo);

    box(ctx, 4, 8, 9, 7, PALETTE.shroud);
    box(ctx, 4, 8, 9, 1, PALETTE.shroudDark);
    box(ctx, 4, 14, 9, 1, PALETTE.shroudDark);

    for (let i = 0; i < 3; i++) {
        const ry = 9 + i * 2;
        box(ctx, 5, ry, 7, 1, PALETTE.boneHi);
        pixel(ctx, 8, ry, PALETTE.shroudDark);
    }

    box(ctx, 1, 10, 3, 1, PALETTE.boneHi);
    box(ctx, 12, 10, 3, 1, PALETTE.boneHi);
    box(ctx, 0, 11, 2, 2, PALETTE.boneMid);
    box(ctx, 14, 11, 2, 2, PALETTE.boneMid);

    box(ctx, 4, 15, 9, 1, PALETTE.shroudDark);

    const legY = 16;
    if (frame === 0) {
        box(ctx, 5, legY, 2, 5, PALETTE.boneHi);
        box(ctx, 9, legY, 2, 5, PALETTE.boneHi);
        box(ctx, 4, 21, 4, 1, PALETTE.boneLo);
        box(ctx, 8, 21, 4, 1, PALETTE.boneLo);
    } else {
        box(ctx, 5, legY + 1, 2, 4, PALETTE.boneHi);
        box(ctx, 9, legY, 2, 5, PALETTE.boneHi);
        box(ctx, 4, 21, 4, 1, PALETTE.boneLo);
        box(ctx, 8, 21, 4, 1, PALETTE.boneLo);
    }

    return canvas;
}

/* =========================================================================
 *  ORC BRUTE
 * ========================================================================= */

export function paintOrcBrute(frame) {
    const W = 24, H = 28;
    const { canvas, ctx } = makeCanvas(W, H);
    const stepY = frame === 0 ? 0 : -1;

    box(ctx, 8, 1, 8, 7, PALETTE.orcSkin);
    box(ctx, 8, 1, 8, 1, PALETTE.orcSkinShade);
    box(ctx, 8, 7, 8, 1, PALETTE.orcSkinShade);
    box(ctx, 8, 1, 1, 7, PALETTE.orcSkinShade);
    box(ctx, 15, 1, 1, 7, PALETTE.orcSkinShade);
    box(ctx, 9, 2, 6, 2, PALETTE.orcSkinHi);

    pixel(ctx, 9, 1, PALETTE.orcSkinHi);
    pixel(ctx, 14, 1, PALETTE.orcSkinHi);

    box(ctx, 10, 4, 1, 1, PALETTE.goblinEye);
    box(ctx, 13, 4, 1, 1, PALETTE.goblinEye);
    pixel(ctx, 10, 5, '#7a0c0c');
    pixel(ctx, 13, 5, '#7a0c0c');

    pixel(ctx, 10, 7, PALETTE.orcTusk);
    pixel(ctx, 13, 7, PALETTE.orcTusk);
    pixel(ctx, 10, 8, PALETTE.orcTusk);
    pixel(ctx, 13, 8, PALETTE.orcTusk);

    box(ctx, 4, 8, 16, 11, PALETTE.orcSkin);
    box(ctx, 4, 8, 16, 1, PALETTE.orcSkinShade);
    box(ctx, 4, 18, 16, 1, PALETTE.orcSkinShade);
    box(ctx, 4, 8, 1, 11, PALETTE.orcSkinShade);
    box(ctx, 19, 8, 1, 11, PALETTE.orcSkinShade);
    box(ctx, 5, 9, 14, 2, PALETTE.orcSkinHi);

    box(ctx, 6, 11, 12, 6, PALETTE.orcArmor);
    box(ctx, 6, 11, 12, 1, PALETTE.orcArmorMetal);
    box(ctx, 6, 16, 12, 1, PALETTE.orcArmorMetal);
    pixel(ctx, 8, 13, PALETTE.orcArmorMetal);
    pixel(ctx, 11, 13, PALETTE.orcArmorMetal);
    pixel(ctx, 14, 13, PALETTE.orcArmorMetal);
    pixel(ctx, 9, 15, PALETTE.orcArmorMetal);
    pixel(ctx, 13, 15, PALETTE.orcArmorMetal);

    box(ctx, 1, 10, 3, 8, PALETTE.orcSkin);
    box(ctx, 1, 10, 1, 8, PALETTE.orcSkinShade);
    box(ctx, 20, 10, 3, 8, PALETTE.orcSkin);
    box(ctx, 22, 10, 1, 8, PALETTE.orcSkinShade);

    box(ctx, 21, 4, 2, 8, PALETTE.leather);
    pixel(ctx, 21, 4, PALETTE.leatherDark);
    box(ctx, 19, 1, 6, 4, PALETTE.silverLo);
    box(ctx, 20, 2, 4, 2, PALETTE.silverMid);
    pixel(ctx, 19, 0, PALETTE.silverEdge);
    pixel(ctx, 24, 0, PALETTE.silverEdge);

    const legY = frame === 0 ? 19 : 20;
    box(ctx, 6, legY, 4, 7, PALETTE.orcSkin);
    box(ctx, 14, legY - stepY, 4, 7, PALETTE.orcSkin);
    box(ctx, 6, legY, 1, 7, PALETTE.orcSkinShade);
    box(ctx, 14, legY - stepY, 1, 7, PALETTE.orcSkinShade);
    box(ctx, 5, 26, 6, 2, PALETTE.leatherDark);
    box(ctx, 13, 26 - stepY, 6, 2, PALETTE.leatherDark);

    return canvas;
}

/* =========================================================================
 *  BAT
 * ========================================================================= */

export function paintBat(frame) {
    const W = 14, H = 10;
    const { canvas, ctx } = makeCanvas(W, H);

    box(ctx, 6, 4, 2, 4, PALETTE.batBody);
    box(ctx, 6, 4, 2, 1, PALETTE.batBodyDk);
    pixel(ctx, 6, 5, PALETTE.goblinEye);
    pixel(ctx, 7, 5, PALETTE.goblinEye);

    pixel(ctx, 6, 3, PALETTE.batBodyDk);
    pixel(ctx, 7, 3, PALETTE.batBodyDk);

    if (frame === 0) {
        box(ctx, 0, 2, 6, 1, PALETTE.batBodyDk);
        box(ctx, 0, 3, 6, 2, PALETTE.batBody);
        pixel(ctx, 1, 3, PALETTE.batBodyHi);
        pixel(ctx, 2, 4, PALETTE.batBodyDk);
        pixel(ctx, 4, 4, PALETTE.batBodyDk);

        box(ctx, 8, 2, 6, 1, PALETTE.batBodyDk);
        box(ctx, 8, 3, 6, 2, PALETTE.batBody);
        pixel(ctx, 12, 3, PALETTE.batBodyHi);
        pixel(ctx, 9, 4, PALETTE.batBodyDk);
        pixel(ctx, 11, 4, PALETTE.batBodyDk);
    } else {
        box(ctx, 1, 5, 5, 1, PALETTE.batBodyDk);
        box(ctx, 0, 6, 6, 2, PALETTE.batBody);
        pixel(ctx, 1, 7, PALETTE.batBodyHi);
        pixel(ctx, 3, 7, PALETTE.batBodyDk);

        box(ctx, 8, 5, 5, 1, PALETTE.batBodyDk);
        box(ctx, 8, 6, 6, 2, PALETTE.batBody);
        pixel(ctx, 12, 7, PALETTE.batBodyHi);
        pixel(ctx, 10, 7, PALETTE.batBodyDk);
    }

    return canvas;
}

/* =========================================================================
 *  ZOMBIE
 * ========================================================================= */

export function paintZombie(frame) {
    const W = 16, H = 22;
    const { canvas, ctx } = makeCanvas(W, H);
    const stepY = frame === 0 ? 0 : -1;

    box(ctx, 5, 0, 6, 6, PALETTE.zombieFleshHi);
    box(ctx, 5, 0, 6, 1, PALETTE.zombieFleshDk);
    box(ctx, 5, 5, 6, 1, PALETTE.zombieFleshDk);
    box(ctx, 5, 0, 1, 6, PALETTE.zombieFleshMid);
    box(ctx, 10, 0, 1, 6, PALETTE.zombieFleshMid);

    box(ctx, 6, 2, 2, 1, PALETTE.zombieFleshDk);
    box(ctx, 9, 2, 2, 1, PALETTE.zombieFleshDk);
    pixel(ctx, 7, 2, PALETTE.zombieEye);
    pixel(ctx, 9, 2, PALETTE.zombieEye);

    box(ctx, 6, 4, 4, 1, PALETTE.zombieFleshDk);
    pixel(ctx, 7, 4, PALETTE.blood);

    box(ctx, 4, 6, 8, 9, PALETTE.zombieFleshMid);
    box(ctx, 4, 6, 8, 1, PALETTE.zombieFleshDk);
    pixel(ctx, 6, 8, PALETTE.blood);
    pixel(ctx, 9, 11, PALETTE.blood);
    pixel(ctx, 5, 12, PALETTE.zombieFleshDk);
    pixel(ctx, 10, 9, PALETTE.zombieFleshDk);

    box(ctx, 1, 8 + stepY, 3, 5, PALETTE.zombieFleshHi);
    box(ctx, 1, 8 + stepY, 1, 5, PALETTE.zombieFleshMid);
    box(ctx, 12, 8 - stepY, 3, 5, PALETTE.zombieFleshHi);
    box(ctx, 14, 8 - stepY, 1, 5, PALETTE.zombieFleshMid);

    box(ctx, 4, 15, 8, 1, '#3a2410');

    if (frame === 0) {
        box(ctx, 5, 16, 2, 5, PALETTE.zombieFleshHi);
        box(ctx, 9, 16, 2, 5, PALETTE.zombieFleshHi);
    } else {
        box(ctx, 5, 17, 2, 4, PALETTE.zombieFleshHi);
        box(ctx, 9, 16, 2, 5, PALETTE.zombieFleshHi);
    }
    box(ctx, 4, 21, 4, 1, PALETTE.black);
    box(ctx, 8, 21, 4, 1, PALETTE.black);

    return canvas;
}

/* =========================================================================
 *  WRAITH
 * ========================================================================= */

export function paintWraith(frame) {
    const W = 16, H = 22;
    const { canvas, ctx } = makeCanvas(W, H);
    const sway = frame === 0 ? 0 : 1;

    box(ctx, 5 + sway, 1, 6, 1, PALETTE.shroudPurpleDk);
    box(ctx, 4 + sway, 2, 8, 5, PALETTE.shroudPurpleMid);
    box(ctx, 4 + sway, 2, 1, 5, PALETTE.shroudPurpleDk);
    box(ctx, 11 + sway, 2, 1, 5, PALETTE.shroudPurpleDk);
    box(ctx, 4 + sway, 6, 8, 1, PALETTE.shroudPurpleDk);

    pixel(ctx, 6 + sway, 4, PALETTE.wraithEye);
    pixel(ctx, 9 + sway, 4, PALETTE.wraithEye);
    pixel(ctx, 6 + sway, 5, PALETTE.wraithEyeHi);
    pixel(ctx, 9 + sway, 5, PALETTE.wraithEyeHi);

    box(ctx, 3, 7, 10, 8, PALETTE.shroudPurpleMid);
    box(ctx, 3, 7, 1, 8, PALETTE.shroudPurpleDk);
    box(ctx, 12, 7, 1, 8, PALETTE.shroudPurpleDk);
    pixel(ctx, 5, 10, PALETTE.shroudPurple);
    pixel(ctx, 10, 12, PALETTE.shroudPurple);

    if (frame === 0) {
        box(ctx, 4, 15, 2, 4, PALETTE.shroudPurpleMid);
        box(ctx, 7, 15, 2, 5, PALETTE.shroudPurpleMid);
        box(ctx, 10, 15, 2, 3, PALETTE.shroudPurpleMid);
        pixel(ctx, 4, 19, PALETTE.shroudPurpleDk);
        pixel(ctx, 8, 20, PALETTE.shroudPurpleDk);
    } else {
        box(ctx, 4, 15, 2, 3, PALETTE.shroudPurpleMid);
        box(ctx, 7, 15, 2, 4, PALETTE.shroudPurpleMid);
        box(ctx, 10, 15, 2, 5, PALETTE.shroudPurpleMid);
        pixel(ctx, 8, 19, PALETTE.shroudPurpleDk);
        pixel(ctx, 11, 20, PALETTE.shroudPurpleDk);
    }

    return canvas;
}

/* =========================================================================
 *  BEHOLDER
 * ========================================================================= */

export function paintBeholder(frame) {
    const W = 22, H = 22;
    const { canvas, ctx } = makeCanvas(W, H);
    const sway = frame === 0 ? 0 : 1;

    box(ctx, 8, 3, 6, 1, PALETTE.beholderSkinDk);
    box(ctx, 6, 4, 10, 1, PALETTE.beholderSkinDk);
    box(ctx, 5, 5, 12, 1, PALETTE.beholderSkinDk);

    box(ctx, 5, 6, 12, 10, PALETTE.beholderSkin);
    box(ctx, 4, 7, 1, 8, PALETTE.beholderSkin);
    box(ctx, 17, 7, 1, 8, PALETTE.beholderSkin);
    box(ctx, 6, 6, 10, 2, PALETTE.beholderSkinHi);

    box(ctx, 5, 16, 12, 1, PALETTE.beholderSkinDk);
    box(ctx, 6, 17, 10, 1, PALETTE.beholderSkinDk);
    box(ctx, 8, 18, 6, 1, PALETTE.beholderSkinDk);

    box(ctx, 8, 9, 6, 4, PALETTE.eyeWhite);
    box(ctx, 8, 9, 6, 1, PALETTE.silverMid);
    box(ctx, 9, 10, 4, 2, PALETTE.eyeIris);
    box(ctx, 10, 10, 2, 1, PALETTE.eyeIrisDk);
    pixel(ctx, 10, 11, '#ffffff');

    pixel(ctx, 3, 5 + sway, PALETTE.eyeWhite);
    pixel(ctx, 3, 6 + sway, PALETTE.goblinEye);
    pixel(ctx, 18, 5 - sway, PALETTE.eyeWhite);
    pixel(ctx, 18, 6 - sway, PALETTE.goblinEye);
    pixel(ctx, 10, 1 + sway, PALETTE.eyeWhite);
    pixel(ctx, 11, 1 + sway, PALETTE.goblinEye);

    box(ctx, 2, 3 + sway, 1, 3, PALETTE.beholderSkinDk);
    box(ctx, 19, 3 + sway, 1, 3, PALETTE.beholderSkinDk);
    box(ctx, 10, 3 + sway, 1, 2, PALETTE.beholderSkinDk);
    box(ctx, 11, 3 + sway, 1, 2, PALETTE.beholderSkinDk);

    box(ctx, 9, 14, 4, 1, PALETTE.beholderSkinDk);
    pixel(ctx, 9, 14, PALETTE.eyeWhite);
    pixel(ctx, 12, 14, PALETTE.eyeWhite);

    return canvas;
}

/* =========================================================================
 *  GOBLIN SNIPER (red mohawk, bow)
 * ========================================================================= */

export function paintGoblinSniper(frame) {
    const W = 16, H = 20;
    const { canvas, ctx } = makeCanvas(W, H);
    const stepY = frame === 0 ? 0 : -1;

    box(ctx, 6, 0, 4, 1, PALETTE.plumeBright);
    box(ctx, 5, 1, 6, 1, PALETTE.plumeBright);
    pixel(ctx, 5, 0, PALETTE.plumeMid);
    pixel(ctx, 10, 0, PALETTE.plumeMid);
    box(ctx, 6, 2, 4, 1, PALETTE.plumeDark);

    box(ctx, 4, 3, 8, 5, PALETTE.goblinSkin);
    box(ctx, 4, 3, 1, 5, PALETTE.goblinSkinShade);
    box(ctx, 11, 3, 1, 5, PALETTE.goblinSkinShade);
    box(ctx, 5, 3, 6, 1, PALETTE.goblinSkinHi);

    box(ctx, 2, 4, 2, 3, PALETTE.goblinSkin);
    pixel(ctx, 2, 4, PALETTE.goblinSkinShade);
    box(ctx, 12, 4, 2, 3, PALETTE.goblinSkin);
    pixel(ctx, 13, 4, PALETTE.goblinSkinShade);

    pixel(ctx, 6, 5, PALETTE.goblinEye);
    pixel(ctx, 9, 5, PALETTE.goblinEye);
    pixel(ctx, 7, 7, PALETTE.goblinSkinShade);

    box(ctx, 4, 8, 8, 5, PALETTE.leather);
    box(ctx, 4, 8, 1, 5, PALETTE.leatherDark);
    box(ctx, 11, 8, 1, 5, PALETTE.leatherDark);
    box(ctx, 5, 8, 6, 1, PALETTE.leatherDark);

    if (frame === 0) {
        box(ctx, 13, 8, 1, 5, '#7a4422');
        pixel(ctx, 14, 9, '#7a4422');
        pixel(ctx, 14, 11, '#7a4422');
        box(ctx, 9, 10, 5, 1, PALETTE.silverMid);
        pixel(ctx, 14, 10, PALETTE.silverHi);
    } else {
        box(ctx, 13, 9, 1, 3, '#7a4422');
        pixel(ctx, 14, 10, '#7a4422');
    }

    box(ctx, 1, 9, 3, 4, PALETTE.silverMid);
    box(ctx, 1, 9, 1, 4, PALETTE.silverEdge);
    pixel(ctx, 2, 11, PALETTE.black);

    const legY = 13;
    if (frame === 0) {
        box(ctx, 5, legY, 2, 5, PALETTE.goblinSkin);
        box(ctx, 9, legY, 2, 5, PALETTE.goblinSkin);
    } else {
        box(ctx, 5, legY + 1, 2, 4, PALETTE.goblinSkin);
        box(ctx, 9, legY, 2, 5, PALETTE.goblinSkin);
    }
    box(ctx, 4, 18, 3, 1, PALETTE.black);
    box(ctx, 9, 18, 3, 1, PALETTE.black);

    return canvas;
}

/* =========================================================================
 *  GOBLIN BERSERKER (dual scimitars)
 * ========================================================================= */

export function paintGoblinBerserker(frame) {
    const W = 18, H = 20;
    const { canvas, ctx } = makeCanvas(W, H);

    box(ctx, 6, 0, 6, 1, PALETTE.goblinSkin);
    box(ctx, 5, 1, 8, 6, PALETTE.goblinSkin);
    box(ctx, 5, 1, 1, 6, PALETTE.goblinSkinShade);
    box(ctx, 12, 1, 1, 6, PALETTE.goblinSkinShade);
    box(ctx, 6, 1, 6, 1, PALETTE.goblinSkinHi);

    box(ctx, 5, 4, 5, 1, PALETTE.blood);
    pixel(ctx, 7, 3, PALETTE.blood);

    box(ctx, 7, 3, 1, 1, PALETTE.zombieEye);
    box(ctx, 10, 3, 1, 1, PALETTE.zombieEye);

    box(ctx, 2, 2, 3, 4, PALETTE.goblinSkin);
    pixel(ctx, 2, 2, PALETTE.goblinSkinShade);
    box(ctx, 13, 2, 3, 4, PALETTE.goblinSkin);
    pixel(ctx, 15, 2, PALETTE.goblinSkinShade);

    pixel(ctx, 7, 6, PALETTE.boneHi);
    pixel(ctx, 10, 6, PALETTE.boneHi);

    box(ctx, 4, 7, 10, 6, PALETTE.goblinSkin);
    box(ctx, 4, 7, 10, 1, PALETTE.goblinSkinShade);
    box(ctx, 4, 12, 10, 1, PALETTE.goblinSkinShade);

    box(ctx, 5, 8, 8, 2, PALETTE.leather);
    box(ctx, 5, 8, 8, 1, PALETTE.leatherDark);

    pixel(ctx, 7, 11, PALETTE.boneHi);
    pixel(ctx, 9, 11, PALETTE.boneHi);
    pixel(ctx, 11, 11, PALETTE.boneHi);

    if (frame === 0) {
        box(ctx, 0, 8, 1, 5, PALETTE.silverHi);
        pixel(ctx, 1, 9, PALETTE.silverHi);
        pixel(ctx, 0, 12, PALETTE.gold);
        box(ctx, 17, 8, 1, 5, PALETTE.silverHi);
        pixel(ctx, 16, 9, PALETTE.silverHi);
        pixel(ctx, 17, 12, PALETTE.gold);
    } else {
        box(ctx, 1, 6, 5, 1, PALETTE.silverHi);
        pixel(ctx, 0, 7, PALETTE.silverHi);
        pixel(ctx, 6, 7, PALETTE.gold);
        box(ctx, 12, 6, 5, 1, PALETTE.silverHi);
        pixel(ctx, 17, 7, PALETTE.silverHi);
        pixel(ctx, 11, 7, PALETTE.gold);
    }

    box(ctx, 5, 13, 8, 2, PALETTE.goblinLoin);
    box(ctx, 5, 13, 8, 1, PALETTE.leatherDark);

    const legY = 15;
    if (frame === 0) {
        box(ctx, 5, legY, 3, 4, PALETTE.goblinSkin);
        box(ctx, 10, legY, 3, 4, PALETTE.goblinSkin);
    } else {
        box(ctx, 5, legY + 1, 3, 3, PALETTE.goblinSkin);
        box(ctx, 10, legY, 3, 4, PALETTE.goblinSkin);
    }
    box(ctx, 4, 19, 4, 1, PALETTE.black);
    box(ctx, 10, 19, 4, 1, PALETTE.black);

    return canvas;
}

/* =========================================================================
 *  FIRE ELEMENTAL
 * ========================================================================= */

/*
 * Pyra Flameheart / Fire Elemental.
 *
 * Layered, animated flame body. Each frame shifts:
 *   - the crown plume left/right and up/down (flicker)
 *   - the eye glow brightness (eyes "breathe" hotter then cooler)
 *   - secondary side wisps (curl in alternating directions)
 *   - dancing ember sparks (4 different positions)
 *   - tongue tips at the bottom (alternating flare)
 *
 * Frames 0 and 2 are "settled" poses; frames 1 and 3 are "peak" poses
 * with bigger plume and brighter core. The 4-frame cycle reads as a
 * rapid hot flicker rather than a slow heartbeat.
 */
const FIRE_ELEM_POSE = [
    { plumeShift: 0, plumeY: 0, coreVol: 0, wispCurl: 0, embers: [[2, 9], [15, 13]],  tongues: [0, 0],  eyeHot: false },
    { plumeShift: 1, plumeY: -1, coreVol: 1, wispCurl: 1, embers: [[1, 11], [16, 8]],  tongues: [-1, 1], eyeHot: true  },
    { plumeShift: 0, plumeY: 0, coreVol: 0, wispCurl: 0, embers: [[3, 6], [14, 11]],  tongues: [0, 0],  eyeHot: false },
    { plumeShift: -1, plumeY: -1, coreVol: 1, wispCurl: -1, embers: [[2, 13], [15, 9]],  tongues: [1, -1], eyeHot: true  }
];

export function paintFireElemental(frame) {
    const W = 18, H = 24;
    const { canvas, ctx } = makeCanvas(W, H);
    const pose = FIRE_ELEM_POSE[frame] || FIRE_ELEM_POSE[0];
    const ps = pose.plumeShift;
    const py = pose.plumeY;

    // Crown plume - tallest and brightest at the very top, fading out
    pixel(ctx, 8 + ps, 0 + py, PALETTE.fireWhite);
    pixel(ctx, 9 + ps, 0 + py, PALETTE.fireWhite);
    box(ctx, 7 + ps, 1 + py, 4, 1, PALETTE.fireYellow);
    box(ctx, 6 + ps, 2 + py, 6, 1, PALETTE.fireOrange);
    pixel(ctx, 8 + ps, 2 + py, PALETTE.fireYellow);
    pixel(ctx, 9 + ps, 2 + py, PALETTE.fireYellow);
    box(ctx, 5 + ps, 3 + py, 8, 1, PALETTE.fireRed);
    box(ctx, 6 + ps, 4 + py, 6, 1, PALETTE.fireOrange);

    // Brow / face zone
    box(ctx, 4, 5, 10, 4, PALETTE.fireOrange);
    box(ctx, 3, 6, 12, 3, PALETTE.fireRed);
    box(ctx, 4, 9, 10, 1, PALETTE.fireRed);
    pixel(ctx, 3, 5, PALETTE.fireOrange);
    pixel(ctx, 14, 5, PALETTE.fireOrange);

    // Eyes - hot/cool variation
    const eyeColor = pose.eyeHot ? PALETTE.fireWhite : PALETTE.fireYellow;
    const eyeAura = pose.eyeHot ? PALETTE.fireYellow : PALETTE.fireOrange;
    box(ctx, 6, 6, 2, 2, eyeAura);
    box(ctx, 10, 6, 2, 2, eyeAura);
    pixel(ctx, 7, 7, eyeColor);
    pixel(ctx, 11, 7, eyeColor);
    if (pose.eyeHot) {
        // Brief glint flares above eyes when hottest
        pixel(ctx, 7, 5, PALETTE.fireWhite);
        pixel(ctx, 11, 5, PALETTE.fireWhite);
    }

    // Mouth - flame-tongue
    pixel(ctx, 8, 9, PALETTE.fireWhite);
    pixel(ctx, 9, 9, PALETTE.fireWhite);
    pixel(ctx, 8, 10, PALETTE.fireYellow);
    pixel(ctx, 9, 10, PALETTE.fireYellow);

    // Inner core - white-hot center, larger on "peak" frames
    const coreSpread = pose.coreVol;
    box(ctx, 6 - coreSpread, 11, 6 + coreSpread * 2, 4, PALETTE.fireYellow);
    box(ctx, 7, 11, 4, 4, PALETTE.fireWhite);
    pixel(ctx, 8, 12, PALETTE.fireWhite);
    pixel(ctx, 9, 12, PALETTE.fireWhite);
    pixel(ctx, 8, 13, PALETTE.fireWhite);
    pixel(ctx, 9, 13, PALETTE.fireWhite);

    // Outer body flames - red/orange shroud
    box(ctx, 4, 12, 10, 7, PALETTE.fireRed);
    box(ctx, 5, 12, 8, 7, PALETTE.fireOrange);
    pixel(ctx, 5, 13, PALETTE.fireYellow);
    pixel(ctx, 12, 13, PALETTE.fireYellow);
    pixel(ctx, 6, 16, PALETTE.fireYellow);
    pixel(ctx, 11, 17, PALETTE.fireYellow);
    pixel(ctx, 8, 18, PALETTE.fireWhite);
    pixel(ctx, 9, 18, PALETTE.fireWhite);

    // Side wisps - curl direction alternates
    const curl = pose.wispCurl;
    if (curl === 0) {
        box(ctx, 2, 8, 2, 5, PALETTE.fireRed);
        box(ctx, 14, 8, 2, 5, PALETTE.fireRed);
        pixel(ctx, 1, 11, PALETTE.fireOrange);
        pixel(ctx, 16, 11, PALETTE.fireOrange);
        pixel(ctx, 2, 9, PALETTE.fireYellow);
        pixel(ctx, 15, 9, PALETTE.fireYellow);
    } else if (curl > 0) {
        box(ctx, 1, 9, 2, 5, PALETTE.fireRed);
        box(ctx, 15, 9, 2, 5, PALETTE.fireRed);
        pixel(ctx, 0, 12, PALETTE.fireDeep);
        pixel(ctx, 17, 11, PALETTE.fireOrange);
        pixel(ctx, 1, 10, PALETTE.fireOrange);
        pixel(ctx, 16, 10, PALETTE.fireYellow);
    } else {
        box(ctx, 1, 11, 2, 4, PALETTE.fireRed);
        box(ctx, 15, 11, 2, 4, PALETTE.fireRed);
        pixel(ctx, 0, 11, PALETTE.fireOrange);
        pixel(ctx, 17, 14, PALETTE.fireDeep);
        pixel(ctx, 1, 12, PALETTE.fireYellow);
        pixel(ctx, 16, 12, PALETTE.fireOrange);
    }

    // Trailing sparks - 2 floating embers per frame
    for (const [ex, ey] of pose.embers) {
        if (ex >= 0 && ex < W && ey >= 0 && ey < H) {
            pixel(ctx, ex, ey, PALETTE.fireYellow);
            if (ex - 1 >= 0) pixel(ctx, ex - 1, ey, PALETTE.fireOrange);
            if (ey + 1 < H) pixel(ctx, ex, ey + 1, PALETTE.fireDeep);
        }
    }

    // Lower body / fading flame trail (no legs - elemental floats)
    box(ctx, 5, 19, 8, 3, PALETTE.fireRed);
    box(ctx, 6, 20, 6, 2, PALETTE.fireOrange);
    pixel(ctx, 8, 21, PALETTE.fireYellow);
    pixel(ctx, 9, 21, PALETTE.fireYellow);

    // Tongue tips at bottom - alternating flare
    const tL = pose.tongues[0];
    const tR = pose.tongues[1];
    box(ctx, 4 + tL, 22, 3, 2, PALETTE.fireRed);
    box(ctx, 11 + tR, 22, 3, 2, PALETTE.fireRed);
    pixel(ctx, 5 + tL, 22, PALETTE.fireOrange);
    pixel(ctx, 12 + tR, 22, PALETTE.fireOrange);
    pixel(ctx, 5 + tL, 23, PALETTE.fireDeep);
    pixel(ctx, 12 + tR, 23, PALETTE.fireDeep);

    // Smoke wisps trailing up off the shoulders (top corners)
    pixel(ctx, 3, 4, PALETTE.fireSmoke);
    pixel(ctx, 14, 4, PALETTE.fireSmoke);

    return canvas;
}

/* =========================================================================
 *  NECROTECH CONSTRUCT (rust + glowing green core)
 * ========================================================================= */

export function paintNecrotech(frame) {
    const W = 24, H = 28;
    const { canvas, ctx } = makeCanvas(W, H);

    box(ctx, 5, 0, 2, 3, PALETTE.techMetalDk);
    box(ctx, 17, 0, 2, 3, PALETTE.techMetalDk);
    pixel(ctx, 5, 0, PALETTE.black);
    pixel(ctx, 18, 0, PALETTE.black);

    box(ctx, 7, 2, 10, 8, PALETTE.techMetal);
    box(ctx, 7, 2, 10, 1, PALETTE.techMetalDk);
    box(ctx, 7, 9, 10, 1, PALETTE.techMetalDk);
    box(ctx, 7, 2, 1, 8, PALETTE.techMetalDk);
    box(ctx, 16, 2, 1, 8, PALETTE.techMetalDk);
    box(ctx, 8, 3, 8, 1, PALETTE.techMetalHi);

    box(ctx, 9, 5, 2, 2, '#ff0000');
    box(ctx, 13, 5, 2, 2, '#ff0000');
    pixel(ctx, 9, 5, PALETTE.fireWhite);
    pixel(ctx, 13, 5, PALETTE.fireWhite);

    box(ctx, 9, 8, 6, 1, PALETTE.techRust);
    pixel(ctx, 10, 8, PALETTE.boneHi);
    pixel(ctx, 12, 8, PALETTE.boneHi);
    pixel(ctx, 14, 8, PALETTE.boneHi);

    box(ctx, 4, 10, 16, 13, PALETTE.techMetal);
    box(ctx, 4, 10, 16, 1, PALETTE.techMetalDk);
    box(ctx, 4, 22, 16, 1, PALETTE.techMetalDk);
    box(ctx, 4, 10, 1, 13, PALETTE.techMetalDk);
    box(ctx, 19, 10, 1, 13, PALETTE.techMetalDk);
    box(ctx, 5, 11, 14, 2, PALETTE.techMetalHi);

    box(ctx, 9, 14, 6, 6, PALETTE.techCore);
    box(ctx, 10, 15, 4, 4, PALETTE.techCoreHi);
    pixel(ctx, 11, 16, PALETTE.fireWhite);
    pixel(ctx, 12, 16, PALETTE.fireWhite);

    box(ctx, 3, 12, 1, 6, PALETTE.techMetalDk);
    pixel(ctx, 2, 14, PALETTE.techMetalDk);
    pixel(ctx, 2, 17, PALETTE.techMetalDk);
    box(ctx, 20, 12, 1, 6, PALETTE.techMetalDk);

    pixel(ctx, 5, 13, PALETTE.techMetalHi);
    pixel(ctx, 18, 13, PALETTE.techMetalHi);
    pixel(ctx, 5, 21, PALETTE.techMetalHi);
    pixel(ctx, 18, 21, PALETTE.techMetalHi);

    if (frame === 0) {
        box(ctx, 21, 8, 2, 14, PALETTE.silverLo);
        box(ctx, 21, 8, 1, 14, PALETTE.techMetalDk);
        pixel(ctx, 22, 12, PALETTE.techRust);
        pixel(ctx, 22, 16, PALETTE.techRust);
        box(ctx, 20, 22, 4, 1, PALETTE.techMetalDk);
        pixel(ctx, 4, 11, '#aaaaaa');
        pixel(ctx, 19, 11, '#aaaaaa');
    } else {
        box(ctx, 21, 10, 2, 14, PALETTE.silverLo);
        box(ctx, 20, 24, 4, 1, PALETTE.techMetalDk);
    }

    box(ctx, 6, 23, 4, 5, PALETTE.techMetal);
    box(ctx, 14, 23, 4, 5, PALETTE.techMetal);
    box(ctx, 6, 23, 1, 5, PALETTE.techMetalDk);
    box(ctx, 14, 23, 1, 5, PALETTE.techMetalDk);
    box(ctx, 5, 27, 6, 1, PALETTE.black);
    box(ctx, 13, 27, 6, 1, PALETTE.black);

    return canvas;
}

/* =========================================================================
 *  SHADOWMANCER (hooded void caster)
 * ========================================================================= */

/*
 * Lyra Shadowmancer.
 *
 * Floating hooded sorceress with:
 *   - 4-frame "float bob" cycle (idle hover, no legs visible)
 *   - Glowing eye twin-stars in the hood shadow that pulse per frame
 *   - Animated magic orb spun in her right hand (color/position cycle)
 *   - Glowing runic sigils embroidered down the front of the robe
 *   - Cape with darker fold lines + frame-driven sway
 *   - Bone-pale fingertip glints peeking out of the sleeves
 *   - Trailing tatters at the hem that swing opposite to the cape
 *
 * Pose state:
 *   bob       - vertical float offset (negative = higher)
 *   sway      - lateral sway of the robe (cape + sleeves)
 *   eyeBright - true on "peak" frames so eyes pulse
 *   orbY      - vertical position of the orb (orbits up/down per frame)
 *   orbColor  - alternates magic-bright and magic-deep
 *   hemSwing  - hem tatter offset (mirror of cape sway)
 */
const SHADOWMANCER_POSE = [
    { bob: 0,  sway: 0,  eyeBright: false, orbY: 0,  orbColor: 'mid',  hemSwing: 0 },
    { bob: -1, sway: 1,  eyeBright: true,  orbY: -1, orbColor: 'hi',   hemSwing: -1 },
    { bob: 0,  sway: 0,  eyeBright: false, orbY: 0,  orbColor: 'mid',  hemSwing: 0 },
    { bob: -1, sway: -1, eyeBright: true,  orbY: -2, orbColor: 'core', hemSwing: 1 }
];

export function paintShadowmancer(frame) {
    const W = 18, H = 28;
    const { canvas, ctx } = makeCanvas(W, H);
    const pose = SHADOWMANCER_POSE[frame] || SHADOWMANCER_POSE[0];
    const yo = pose.bob;
    const sw = pose.sway;

    // Pointed hood tip
    box(ctx, 8, 0 + yo, 2, 2, '#1a0a26');
    box(ctx, 7, 2 + yo, 4, 2, '#2a1a3a');
    pixel(ctx, 9, 1 + yo, PALETTE.shroudPurple);

    // Hood proper - shaped funnel framing the face
    box(ctx, 5, 4 + yo, 8, 7, PALETTE.shroudPurpleMid);
    box(ctx, 5, 4 + yo, 1, 7, '#1a0a26');
    box(ctx, 12, 4 + yo, 1, 7, '#1a0a26');
    box(ctx, 5, 4 + yo, 8, 1, '#1a0a26');
    // Inner hood shadow / face cavity
    box(ctx, 6, 5 + yo, 6, 5, PALETTE.shroudPurpleDk);
    pixel(ctx, 6, 5 + yo, PALETTE.shroudPurpleMid);
    pixel(ctx, 11, 5 + yo, PALETTE.shroudPurpleMid);

    // Twin glowing eyes - pulse brighter on peak frames
    const innerEye = pose.eyeBright ? PALETTE.fireWhite : PALETTE.deathGlowHi;
    const outerEye = pose.eyeBright ? PALETTE.deathGlowHi : PALETTE.deathGlow;
    box(ctx, 7, 7 + yo, 1, 2, outerEye);
    box(ctx, 10, 7 + yo, 1, 2, outerEye);
    pixel(ctx, 7, 7 + yo, innerEye);
    pixel(ctx, 10, 7 + yo, innerEye);
    if (pose.eyeBright) {
        // Faint glow halo around eyes when pulsing
        pixel(ctx, 8, 7 + yo, PALETTE.deathGlow);
        pixel(ctx, 9, 7 + yo, PALETTE.deathGlow);
    }

    // Hood trim (silver embroidery edge)
    pixel(ctx, 5, 10 + yo, PALETTE.shroudPurple);
    pixel(ctx, 12, 10 + yo, PALETTE.shroudPurple);
    pixel(ctx, 6, 10 + yo, PALETTE.boneLo);
    pixel(ctx, 11, 10 + yo, PALETTE.boneLo);

    // Robe body - main vestment with shaded sides
    box(ctx, 3 + sw, 11 + yo, 12, 12, '#2a1a3a');
    box(ctx, 3 + sw, 11 + yo, 1, 12, '#1a0a26');
    box(ctx, 14 + sw, 11 + yo, 1, 12, '#1a0a26');
    box(ctx, 3 + sw, 22 + yo, 12, 1, '#1a0a26');
    // Mid-tone vertical center panel
    box(ctx, 5 + sw, 13 + yo, 8, 8, PALETTE.shroudPurpleMid);
    pixel(ctx, 4 + sw, 14 + yo, PALETTE.shroudPurpleDk);
    pixel(ctx, 14 + sw, 14 + yo, PALETTE.shroudPurpleDk);
    pixel(ctx, 7 + sw, 17 + yo, PALETTE.shroudPurple);
    pixel(ctx, 11 + sw, 19 + yo, PALETTE.shroudPurple);

    // Glowing runic sigils stitched down the front
    pixel(ctx, 8 + sw, 14 + yo, PALETTE.deathGlow);
    pixel(ctx, 9 + sw, 14 + yo, PALETTE.deathGlow);
    pixel(ctx, 8 + sw, 15 + yo, PALETTE.deathGlowHi);
    pixel(ctx, 9 + sw, 15 + yo, PALETTE.deathGlowHi);
    pixel(ctx, 8 + sw, 16 + yo, PALETTE.deathGlow);
    pixel(ctx, 9 + sw, 16 + yo, PALETTE.deathGlow);
    // Lower sigil - second rune
    pixel(ctx, 8 + sw, 19 + yo, PALETTE.deathGlowHi);
    pixel(ctx, 9 + sw, 19 + yo, PALETTE.deathGlowHi);
    pixel(ctx, 7 + sw, 20 + yo, PALETTE.deathGlow);
    pixel(ctx, 10 + sw, 20 + yo, PALETTE.deathGlow);

    // Right sleeve + magic orb hovering over the palm
    // The orb floats up/down per frame and changes color
    const orbY = 14 + yo + pose.orbY;
    const orbColor = {
        mid: { core: PALETTE.magicCore, hi: PALETTE.magicHi, lo: PALETTE.magicLo },
        hi: { core: PALETTE.magicHi, hi: PALETTE.fireWhite, lo: PALETTE.magicCore },
        core: { core: PALETTE.fireWhite, hi: PALETTE.fireWhite, lo: PALETTE.magicHi }
    }[pose.orbColor];
    // Sleeve / forearm
    box(ctx, 14, 12 + yo, 2, 6, '#1a0a26');
    pixel(ctx, 14, 12 + yo, PALETTE.shroudPurpleMid);
    // Hand outlined in bone color, fingertips glowing
    box(ctx, 14, 17 + yo, 2, 1, PALETTE.boneMid);
    pixel(ctx, 14, 17 + yo, PALETTE.deathGlowHi);
    pixel(ctx, 15, 17 + yo, PALETTE.deathGlowHi);
    // Orb body - 3px ball with halo
    box(ctx, 14, orbY, 3, 3, orbColor.core);
    pixel(ctx, 14, orbY, orbColor.hi);
    pixel(ctx, 16, orbY + 2, orbColor.lo);
    // Halo
    pixel(ctx, 13, orbY + 1, orbColor.lo);
    pixel(ctx, 17, orbY + 1, orbColor.lo);
    pixel(ctx, 15, orbY - 1, orbColor.hi);

    // Left sleeve - empty hand (just bone fingertip glints)
    box(ctx, 2, 13 + yo, 2, 5, '#1a0a26');
    pixel(ctx, 2, 13 + yo, PALETTE.shroudPurpleMid);
    pixel(ctx, 3, 17 + yo, PALETTE.boneHi);
    pixel(ctx, 2, 17 + yo, PALETTE.boneMid);
    pixel(ctx, 3, 18 + yo, PALETTE.deathGlow);

    // Hem of the robe - trailing tatters that swing opposite to the cape
    const hs = pose.hemSwing;
    if (frame === 0 || frame === 2) {
        box(ctx, 4, 23 + yo, 2, 4, '#2a1a3a');
        box(ctx, 8, 23 + yo, 2, 5, '#2a1a3a');
        box(ctx, 12, 23 + yo, 2, 4, '#2a1a3a');
        pixel(ctx, 4, 26 + yo, '#1a0a26');
        pixel(ctx, 9, 27 + yo, '#1a0a26');
        pixel(ctx, 13, 26 + yo, '#1a0a26');
    } else {
        box(ctx, 4 + hs, 23 + yo, 2, 5, '#2a1a3a');
        box(ctx, 8 + hs, 23 + yo, 2, 4, '#2a1a3a');
        box(ctx, 12 + hs, 23 + yo, 2, 5, '#2a1a3a');
        pixel(ctx, 4 + hs, 27 + yo, '#1a0a26');
        pixel(ctx, 9 + hs, 26 + yo, '#1a0a26');
        pixel(ctx, 13 + hs, 27 + yo, '#1a0a26');
    }

    // A few trailing shadow particles wisping off the shoulders
    if (pose.eyeBright) {
        pixel(ctx, 1, 12 + yo, PALETTE.shroudPurpleDk);
        pixel(ctx, 16, 11 + yo, PALETTE.shroudPurpleDk);
    }

    return canvas;
}

/* =========================================================================
 *  DEATH KNIGHT (Lord Vorath)
 * ========================================================================= */

export function paintDeathKnight(frame) {
    const W = 24, H = 32;
    const { canvas, ctx } = makeCanvas(W, H);

    box(ctx, 6, 0, 2, 4, PALETTE.deathArmorEdge);
    box(ctx, 16, 0, 2, 4, PALETTE.deathArmorEdge);
    pixel(ctx, 6, 0, PALETTE.black);
    pixel(ctx, 17, 0, PALETTE.black);

    box(ctx, 7, 4, 10, 9, PALETTE.deathArmor);
    box(ctx, 7, 4, 10, 1, PALETTE.black);
    box(ctx, 7, 12, 10, 1, PALETTE.black);
    box(ctx, 7, 4, 1, 9, PALETTE.black);
    box(ctx, 16, 4, 1, 9, PALETTE.black);

    box(ctx, 8, 7, 8, 2, PALETTE.black);
    pixel(ctx, 9, 8, PALETTE.deathGlow);
    pixel(ctx, 11, 8, PALETTE.deathGlow);
    pixel(ctx, 12, 8, PALETTE.deathGlow);
    pixel(ctx, 14, 8, PALETTE.deathGlow);
    pixel(ctx, 9, 7, PALETTE.deathGlowHi);
    pixel(ctx, 14, 7, PALETTE.deathGlowHi);

    box(ctx, 9, 14, 6, 8, PALETTE.deathArmor);
    box(ctx, 10, 15, 4, 4, PALETTE.eyeWhite);
    pixel(ctx, 10, 16, PALETTE.black);
    pixel(ctx, 11, 16, PALETTE.deathGlow);
    pixel(ctx, 12, 16, PALETTE.black);
    pixel(ctx, 13, 16, PALETTE.deathGlow);

    box(ctx, 5, 13, 14, 11, PALETTE.deathArmor);
    box(ctx, 5, 13, 14, 1, PALETTE.black);
    box(ctx, 5, 23, 14, 1, PALETTE.black);
    box(ctx, 5, 13, 1, 11, PALETTE.black);
    box(ctx, 18, 13, 1, 11, PALETTE.black);
    pixel(ctx, 7, 16, PALETTE.shroudPurpleMid);
    pixel(ctx, 17, 18, PALETTE.shroudPurpleMid);

    if (frame === 0) {
        box(ctx, 21, 6, 1, 14, PALETTE.deathGlow);
        box(ctx, 22, 6, 1, 14, PALETTE.deathGlowHi);
        pixel(ctx, 21, 8, PALETTE.fireWhite);
        pixel(ctx, 22, 12, PALETTE.fireWhite);
        box(ctx, 20, 20, 4, 1, PALETTE.gold);
        box(ctx, 21, 21, 2, 2, PALETTE.leather);
    } else {
        box(ctx, 18, 4, 1, 12, PALETTE.deathGlow);
        box(ctx, 19, 4, 1, 12, PALETTE.deathGlowHi);
        pixel(ctx, 18, 6, PALETTE.fireWhite);
        box(ctx, 17, 16, 4, 1, PALETTE.gold);
    }

    box(ctx, 1, 14, 4, 8, PALETTE.deathArmor);
    box(ctx, 1, 14, 4, 1, PALETTE.shroudPurpleMid);
    box(ctx, 1, 21, 4, 1, PALETTE.shroudPurpleMid);
    pixel(ctx, 2, 17, PALETTE.deathGlow);
    pixel(ctx, 3, 17, PALETTE.deathGlow);

    box(ctx, 4, 22, 16, 6, PALETTE.deathArmor);
    box(ctx, 4, 22, 16, 1, PALETTE.black);
    box(ctx, 4, 27, 16, 1, PALETTE.black);

    const legY = 26;
    if (frame === 0) {
        box(ctx, 8, legY, 3, 6, PALETTE.deathArmor);
        box(ctx, 13, legY, 3, 6, PALETTE.deathArmor);
    } else {
        box(ctx, 8, legY + 1, 3, 5, PALETTE.deathArmor);
        box(ctx, 13, legY, 3, 6, PALETTE.deathArmor);
    }
    box(ctx, 7, 31, 4, 1, PALETTE.black);
    box(ctx, 13, 31, 4, 1, PALETTE.black);

    return canvas;
}

/* =========================================================================
 *  FROST GIANT (massive, ice greataxe)
 * ========================================================================= */

/*
 * Borg Frostfist / Frost Giant.
 *
 * Lumbering ice-armored giant with:
 *   - 4-frame walk cycle (lumber: contact, passing, contact mirror,
 *     passing mirror) - bigger than Velorian's so the body bob is more
 *     pronounced
 *   - Layered ice crown with multiple jagged spikes
 *   - White woven beard with frost crystals catching highlights
 *   - Plated chest with ice-mid blue armor + crystal pectorals
 *   - Spiked pauldrons (ice shards on shoulders)
 *   - Belt with cracked-ice buckle and cyan inset gem
 *   - Greataxe held over-shoulder, head pulses with arctic glow
 *   - Trailing frost wisps (small puff of breath/aura per frame)
 *   - Iron-shod boots with frost on the toe
 *
 * Pose:
 *   bodyBob - whole body lift (giants stomp, then peak slightly)
 *   legL/legR - independent foot lifts for passing strides
 *   axeBob - axe rises and falls with the shoulder
 *   beardSway - beard fluttering opposite to body sway
 *   breath - whether to draw a frosty breath plume on this frame
 */
const FROST_GIANT_POSE = [
    { bodyBob: 0,  legL: 0, legR: 0, axeBob: 0,  beardSway: 0,  breath: true  },
    { bodyBob: -1, legL: 0, legR: -1, axeBob: -1, beardSway: 1,  breath: false },
    { bodyBob: 0,  legL: 0, legR: 0, axeBob: 0,  beardSway: 0,  breath: false },
    { bodyBob: -1, legL: -1, legR: 0, axeBob: -1, beardSway: -1, breath: true  }
];

export function paintFrostGiant(frame) {
    const W = 28, H = 36;
    const { canvas, ctx } = makeCanvas(W, H);
    const pose = FROST_GIANT_POSE[frame] || FROST_GIANT_POSE[0];
    const yo = pose.bodyBob;

    // ICE CROWN - multiple jagged spikes of varying heights
    pixel(ctx, 9, 0 + yo, PALETTE.iceMid);
    box(ctx, 10, 1 + yo, 1, 2, PALETTE.iceHi);
    pixel(ctx, 12, 0 + yo, PALETTE.iceHi);
    box(ctx, 12, 1 + yo, 1, 2, PALETTE.iceMid);
    pixel(ctx, 14, 0 + yo, PALETTE.iceMid);
    box(ctx, 14, 1 + yo, 1, 2, PALETTE.iceHi);
    pixel(ctx, 16, 0 + yo, PALETTE.iceHi);
    box(ctx, 16, 1 + yo, 1, 2, PALETTE.iceMid);
    pixel(ctx, 18, 0 + yo, PALETTE.iceMid);
    // Crown band connecting the spikes
    box(ctx, 9, 3 + yo, 10, 1, PALETTE.iceLo);
    box(ctx, 9, 4 + yo, 10, 1, PALETTE.iceMid);
    pixel(ctx, 11, 4 + yo, PALETTE.iceHi);
    pixel(ctx, 17, 4 + yo, PALETTE.iceHi);

    // Face - blue-tinged flesh
    box(ctx, 10, 5 + yo, 8, 6, PALETTE.iceFlesh);
    box(ctx, 10, 5 + yo, 8, 1, PALETTE.iceFleshShade);
    box(ctx, 10, 5 + yo, 1, 6, PALETTE.iceFleshShade);
    box(ctx, 17, 5 + yo, 1, 6, PALETTE.iceFleshShade);
    box(ctx, 11, 6 + yo, 6, 1, PALETTE.iceFleshHi);

    // Eyes - glowing icy white pupils on dark blue sockets
    box(ctx, 12, 7 + yo, 1, 2, PALETTE.iceLo);
    box(ctx, 15, 7 + yo, 1, 2, PALETTE.iceLo);
    pixel(ctx, 12, 8 + yo, PALETTE.iceHi);
    pixel(ctx, 15, 8 + yo, PALETTE.iceHi);
    pixel(ctx, 12, 7 + yo, PALETTE.iceMid);
    pixel(ctx, 15, 7 + yo, PALETTE.iceMid);

    // Brow ridge / scowl
    pixel(ctx, 11, 6 + yo, PALETTE.iceFleshShade);
    pixel(ctx, 16, 6 + yo, PALETTE.iceFleshShade);

    // BEARD - layered white braid with frost specks; sways per frame
    const bs = pose.beardSway;
    box(ctx, 10 + bs, 9 + yo, 8, 4, PALETTE.iceHi);
    box(ctx, 11 + bs, 12 + yo, 6, 1, PALETTE.iceHi);
    box(ctx, 12 + bs, 13 + yo, 4, 1, PALETTE.iceFleshHi);
    // Mouth peeking through beard
    pixel(ctx, 13 + bs, 11 + yo, PALETTE.black);
    pixel(ctx, 14 + bs, 11 + yo, PALETTE.black);
    // Frost crystals scattered through beard
    pixel(ctx, 11 + bs, 10 + yo, PALETTE.iceMid);
    pixel(ctx, 13 + bs, 10 + yo, PALETTE.iceMid);
    pixel(ctx, 16 + bs, 11 + yo, PALETTE.iceMid);
    pixel(ctx, 12 + bs, 12 + yo, PALETTE.silverGlint);

    // Optional cold breath plume (fired only on certain frames)
    if (pose.breath) {
        pixel(ctx, 17 + bs, 11 + yo, PALETTE.iceFleshHi);
        pixel(ctx, 18 + bs, 11 + yo, PALETTE.iceFleshHi);
        pixel(ctx, 19 + bs, 12 + yo, PALETTE.iceHi);
        pixel(ctx, 20 + bs, 12 + yo, PALETTE.iceHi);
        pixel(ctx, 19 + bs, 11 + yo, PALETTE.iceMid);
    }

    // SPIKED PAULDRONS - ice shards on each shoulder
    box(ctx, 4, 12 + yo, 4, 4, PALETTE.iceLo);
    box(ctx, 4, 12 + yo, 4, 1, PALETTE.iceFleshShade);
    pixel(ctx, 5, 12 + yo, PALETTE.iceHi);
    // 3 spikes on left pauldron
    pixel(ctx, 4, 11 + yo, PALETTE.iceHi);
    pixel(ctx, 6, 11 + yo, PALETTE.iceHi);
    pixel(ctx, 5, 10 + yo, PALETTE.iceMid);
    pixel(ctx, 7, 11 + yo, PALETTE.iceMid);

    box(ctx, 20, 12 + yo, 4, 4, PALETTE.iceLo);
    box(ctx, 20, 12 + yo, 4, 1, PALETTE.iceFleshShade);
    pixel(ctx, 21, 12 + yo, PALETTE.iceHi);
    pixel(ctx, 20, 11 + yo, PALETTE.iceHi);
    pixel(ctx, 22, 11 + yo, PALETTE.iceMid);
    pixel(ctx, 23, 11 + yo, PALETTE.iceHi);
    pixel(ctx, 22, 10 + yo, PALETTE.iceMid);

    // CHEST + SHOULDERS (broad neck/clavicle area)
    box(ctx, 6, 13 + yo, 16, 12, PALETTE.iceFlesh);
    box(ctx, 6, 13 + yo, 1, 12, PALETTE.iceFleshShade);
    box(ctx, 21, 13 + yo, 1, 12, PALETTE.iceFleshShade);
    box(ctx, 7, 14 + yo, 14, 2, PALETTE.iceFleshHi);

    // PLATED CHEST - icy armor with subtle bevel
    box(ctx, 8, 16 + yo, 12, 8, PALETTE.iceMid);
    box(ctx, 8, 16 + yo, 12, 1, PALETTE.iceLo);
    box(ctx, 8, 23 + yo, 12, 1, PALETTE.iceLo);
    box(ctx, 8, 16 + yo, 1, 8, PALETTE.iceLo);
    box(ctx, 19, 16 + yo, 1, 8, PALETTE.iceLo);
    box(ctx, 9, 17 + yo, 10, 1, PALETTE.iceHi);
    // Armor plate divisions (vertical seams)
    box(ctx, 11, 17 + yo, 1, 6, PALETTE.iceLo);
    box(ctx, 16, 17 + yo, 1, 6, PALETTE.iceLo);
    // Crystal pectoral inlays
    pixel(ctx, 10, 19 + yo, PALETTE.iceHi);
    pixel(ctx, 13, 20 + yo, PALETTE.iceHi);
    pixel(ctx, 17, 21 + yo, PALETTE.iceHi);
    pixel(ctx, 14, 18 + yo, PALETTE.iceHi);
    pixel(ctx, 9, 22 + yo, PALETTE.iceFleshHi);

    // Central glowing rune embedded in the breastplate
    pixel(ctx, 13, 22 + yo, PALETTE.silverGlint);
    pixel(ctx, 14, 22 + yo, PALETTE.iceHi);

    // GREATAXE - held over the right shoulder, with frame-driven bob
    const ab = pose.axeBob;
    if (frame === 0 || frame === 2) {
        // Haft (vertical wood)
        box(ctx, 23, 5 + yo + ab, 2, 18, PALETTE.leather);
        box(ctx, 23, 5 + yo + ab, 1, 18, PALETTE.leatherDark);
        // Wrappings on the haft
        box(ctx, 23, 8 + yo + ab, 2, 1, PALETTE.leatherHi);
        box(ctx, 23, 14 + yo + ab, 2, 1, PALETTE.leatherHi);
        box(ctx, 23, 20 + yo + ab, 2, 1, PALETTE.leatherHi);
        // Double-sided ice axehead
        box(ctx, 21, 4 + yo + ab, 2, 4, PALETTE.iceMid);
        box(ctx, 25, 4 + yo + ab, 2, 4, PALETTE.iceMid);
        box(ctx, 22, 3 + yo + ab, 4, 1, PALETTE.iceLo);
        box(ctx, 22, 8 + yo + ab, 4, 1, PALETTE.iceLo);
        // Inner highlight on each blade
        pixel(ctx, 22, 4 + yo + ab, PALETTE.iceHi);
        pixel(ctx, 22, 5 + yo + ab, PALETTE.iceHi);
        pixel(ctx, 22, 6 + yo + ab, PALETTE.iceHi);
        pixel(ctx, 26, 5 + yo + ab, PALETTE.iceHi);
        pixel(ctx, 26, 6 + yo + ab, PALETTE.iceHi);
        // Cold pulse glint - alternates corners
        if (frame === 0) {
            pixel(ctx, 24, 5 + yo + ab, PALETTE.silverGlint);
        } else {
            pixel(ctx, 23, 6 + yo + ab, PALETTE.silverGlint);
        }
    } else {
        // Mid-stride: axe lifted higher / angled
        box(ctx, 22, 8 + yo + ab, 2, 16, PALETTE.leather);
        box(ctx, 22, 8 + yo + ab, 1, 16, PALETTE.leatherDark);
        box(ctx, 20, 7 + yo + ab, 2, 4, PALETTE.iceMid);
        box(ctx, 24, 7 + yo + ab, 2, 4, PALETTE.iceMid);
        box(ctx, 21, 6 + yo + ab, 4, 1, PALETTE.iceLo);
        box(ctx, 21, 11 + yo + ab, 4, 1, PALETTE.iceLo);
        pixel(ctx, 21, 8 + yo + ab, PALETTE.iceHi);
        pixel(ctx, 25, 9 + yo + ab, PALETTE.iceHi);
        pixel(ctx, 23, 7 + yo + ab, PALETTE.silverGlint);
    }

    // Off-arm (left) - bare blue arm with bracer
    box(ctx, 3, 14 + yo, 3, 8, PALETTE.iceFlesh);
    box(ctx, 3, 14 + yo, 1, 8, PALETTE.iceFleshShade);
    pixel(ctx, 5, 15 + yo, PALETTE.iceFleshHi);
    // Wrist bracer
    box(ctx, 2, 20 + yo, 4, 2, PALETTE.iceLo);
    pixel(ctx, 3, 20 + yo, PALETTE.iceMid);
    pixel(ctx, 4, 20 + yo, PALETTE.iceHi);
    pixel(ctx, 2, 21 + yo, PALETTE.iceMid);

    // BELT
    box(ctx, 6, 24 + yo, 16, 1, PALETTE.leatherDark);
    box(ctx, 6, 25 + yo, 16, 1, PALETTE.leather);
    // Buckle - cracked ice with cyan inset
    box(ctx, 13, 24 + yo, 3, 2, PALETTE.iceLo);
    pixel(ctx, 13, 24 + yo, PALETTE.iceHi);
    pixel(ctx, 14, 25 + yo, PALETTE.cyanGlowHi);
    pixel(ctx, 15, 24 + yo, PALETTE.silverGlint);

    // Loincloth / fur skirt
    box(ctx, 8, 26 + yo, 12, 3, PALETTE.iceFleshHi);
    box(ctx, 8, 26 + yo, 12, 1, PALETTE.silverMid);
    // Fur tufts hanging down
    pixel(ctx, 9, 28 + yo, PALETTE.iceFlesh);
    pixel(ctx, 13, 28 + yo, PALETTE.iceFlesh);
    pixel(ctx, 17, 28 + yo, PALETTE.iceFlesh);
    pixel(ctx, 11, 28 + yo, PALETTE.silverMid);
    pixel(ctx, 15, 28 + yo, PALETTE.silverMid);

    // LEGS - independent lift per side. yo only applies above the
    // belt; legs stay rooted in the world but the foot at "leg up"
    // lifts a pixel for the passing frame.
    const legY = 29;
    box(ctx, 9, legY + pose.legL, 4, 6, PALETTE.iceFlesh);
    box(ctx, 9, legY + pose.legL, 1, 6, PALETTE.iceFleshShade);
    box(ctx, 15, legY + pose.legR, 4, 6, PALETTE.iceFlesh);
    box(ctx, 15, legY + pose.legR, 1, 6, PALETTE.iceFleshShade);
    pixel(ctx, 11, legY + 2 + pose.legL, PALETTE.iceFleshHi);
    pixel(ctx, 17, legY + 2 + pose.legR, PALETTE.iceFleshHi);
    // Iron-shod boots with a frost rime on the toe
    box(ctx, 8, 35 + pose.legL, 5, 1, PALETTE.black);
    box(ctx, 15, 35 + pose.legR, 5, 1, PALETTE.black);
    pixel(ctx, 11, 35 + pose.legL, PALETTE.silverMid);
    pixel(ctx, 17, 35 + pose.legR, PALETTE.silverMid);

    return canvas;
}

/* =========================================================================
 *  BALOR DEMON (winged, flaming sword)
 * ========================================================================= */

export function paintBalor(frame) {
    const W = 28, H = 32;
    const { canvas, ctx } = makeCanvas(W, H);

    box(ctx, 8, 0, 2, 4, PALETTE.demonHorn);
    box(ctx, 18, 0, 2, 4, PALETTE.demonHorn);
    pixel(ctx, 9, 0, PALETTE.black);
    pixel(ctx, 19, 0, PALETTE.black);
    pixel(ctx, 7, 3, PALETTE.demonHorn);
    pixel(ctx, 20, 3, PALETTE.demonHorn);

    if (frame === 0) {
        box(ctx, 0, 5, 6, 7, PALETTE.demonSkinDk);
        box(ctx, 0, 5, 1, 7, PALETTE.black);
        pixel(ctx, 1, 6, PALETTE.demonSkin);
        pixel(ctx, 3, 8, PALETTE.demonSkin);
        pixel(ctx, 5, 10, PALETTE.demonSkin);
        box(ctx, 22, 5, 6, 7, PALETTE.demonSkinDk);
        box(ctx, 27, 5, 1, 7, PALETTE.black);
        pixel(ctx, 26, 6, PALETTE.demonSkin);
        pixel(ctx, 24, 8, PALETTE.demonSkin);
        pixel(ctx, 22, 10, PALETTE.demonSkin);
    } else {
        box(ctx, 1, 6, 5, 6, PALETTE.demonSkinDk);
        box(ctx, 1, 6, 1, 6, PALETTE.black);
        box(ctx, 22, 6, 5, 6, PALETTE.demonSkinDk);
        box(ctx, 26, 6, 1, 6, PALETTE.black);
    }

    box(ctx, 9, 4, 10, 8, PALETTE.demonSkin);
    box(ctx, 9, 4, 10, 1, PALETTE.demonSkinDk);
    box(ctx, 9, 11, 10, 1, PALETTE.demonSkinDk);
    box(ctx, 9, 4, 1, 8, PALETTE.demonSkinDk);
    box(ctx, 18, 4, 1, 8, PALETTE.demonSkinDk);
    box(ctx, 10, 5, 8, 1, PALETTE.demonSkinHi);

    box(ctx, 11, 7, 2, 2, PALETTE.fireYellow);
    box(ctx, 15, 7, 2, 2, PALETTE.fireYellow);
    pixel(ctx, 11, 7, PALETTE.fireWhite);
    pixel(ctx, 15, 7, PALETTE.fireWhite);

    box(ctx, 11, 9, 6, 2, PALETTE.black);
    pixel(ctx, 11, 10, PALETTE.fireYellow);
    pixel(ctx, 16, 10, PALETTE.fireYellow);
    pixel(ctx, 13, 11, PALETTE.eyeWhite);
    pixel(ctx, 14, 11, PALETTE.eyeWhite);

    box(ctx, 7, 12, 14, 10, PALETTE.demonSkin);
    box(ctx, 7, 12, 14, 1, PALETTE.demonSkinDk);
    box(ctx, 7, 21, 14, 1, PALETTE.demonSkinDk);
    box(ctx, 7, 12, 1, 10, PALETTE.demonSkinDk);
    box(ctx, 20, 12, 1, 10, PALETTE.demonSkinDk);
    box(ctx, 8, 13, 12, 2, PALETTE.demonSkinHi);

    box(ctx, 9, 14, 10, 5, PALETTE.demonSkinDk);
    pixel(ctx, 11, 16, PALETTE.leatherDark);
    pixel(ctx, 14, 16, PALETTE.leatherDark);
    pixel(ctx, 17, 16, PALETTE.leatherDark);
    pixel(ctx, 12, 18, PALETTE.fireOrange);
    pixel(ctx, 15, 18, PALETTE.fireOrange);

    if (frame === 0) {
        box(ctx, 23, 8, 2, 14, PALETTE.fireYellow);
        box(ctx, 23, 8, 1, 14, PALETTE.fireOrange);
        pixel(ctx, 24, 10, PALETTE.fireWhite);
        pixel(ctx, 24, 14, PALETTE.fireWhite);
        pixel(ctx, 22, 9, PALETTE.fireOrange);
        pixel(ctx, 25, 11, PALETTE.fireOrange);
        pixel(ctx, 22, 13, PALETTE.fireOrange);
        pixel(ctx, 25, 16, PALETTE.fireOrange);
        box(ctx, 22, 22, 4, 1, PALETTE.black);
    } else {
        box(ctx, 23, 10, 2, 14, PALETTE.fireYellow);
        box(ctx, 23, 10, 1, 14, PALETTE.fireOrange);
    }

    box(ctx, 4, 14, 2, 1, PALETTE.fireOrange);
    box(ctx, 2, 16, 2, 1, PALETTE.fireOrange);
    pixel(ctx, 0, 18, PALETTE.fireOrange);

    box(ctx, 6, 22, 2, 6, PALETTE.demonSkin);
    pixel(ctx, 5, 26, PALETTE.demonSkin);
    pixel(ctx, 4, 28, PALETTE.demonSkinDk);

    const legY = 22;
    box(ctx, 9, legY, 4, 8, PALETTE.demonSkin);
    box(ctx, 15, legY, 4, 8, PALETTE.demonSkin);
    box(ctx, 9, legY, 1, 8, PALETTE.demonSkinDk);
    box(ctx, 15, legY, 1, 8, PALETTE.demonSkinDk);

    box(ctx, 8, 30, 5, 2, PALETTE.black);
    box(ctx, 14, 30, 5, 2, PALETTE.black);

    return canvas;
}

/* =========================================================================
 *  XP GEMS
 * ========================================================================= */

function paintGem(hi, mid, lo) {
    const { canvas, ctx } = makeCanvas(8, 8);
    box(ctx, 3, 0, 2, 1, mid);
    box(ctx, 2, 1, 4, 1, mid);
    box(ctx, 1, 2, 6, 1, mid);
    box(ctx, 0, 3, 8, 1, mid);
    box(ctx, 1, 4, 6, 1, lo);
    box(ctx, 2, 5, 4, 1, lo);
    box(ctx, 3, 6, 2, 1, lo);

    pixel(ctx, 3, 1, hi);
    pixel(ctx, 2, 2, hi);
    pixel(ctx, 4, 2, hi);
    pixel(ctx, 1, 3, hi);
    pixel(ctx, 3, 3, hi);
    return canvas;
}

export function paintGemBlue() {
    return paintGem(PALETTE.gemBlueHi, PALETTE.gemBlue, PALETTE.gemBlueLo);
}

export function paintGemGreen() {
    return paintGem(PALETTE.gemGreenHi, PALETTE.gemGreen, PALETTE.gemGreenLo);
}

export function paintGemGold() {
    return paintGem(PALETTE.gemGoldHi, PALETTE.gemGoldMid, PALETTE.gemGoldLo);
}

/* Health heart pickup (8x8). Three-tone shading: bright pink highlights
 * on the upper lobes, a saturated red main body, and a dark crimson
 * shadow tucked into the lower point so it reads as 3D against grass,
 * stone, or library tiles. */
export function paintHeart() {
    const { canvas, ctx } = makeCanvas(8, 8);
    const hi = '#ffc1c8';
    const mid = '#e63946';
    const lo = '#7a0e1c';

    /* lobes (top row of the heart) */
    box(ctx, 1, 1, 2, 1, mid);
    box(ctx, 5, 1, 2, 1, mid);
    /* widest band */
    box(ctx, 0, 2, 8, 1, mid);
    box(ctx, 0, 3, 8, 1, mid);
    /* taper toward the point */
    box(ctx, 1, 4, 6, 1, mid);
    box(ctx, 2, 5, 4, 1, lo);
    box(ctx, 3, 6, 2, 1, lo);

    /* highlights */
    pixel(ctx, 1, 1, hi);
    pixel(ctx, 5, 1, hi);
    pixel(ctx, 1, 2, hi);
    pixel(ctx, 5, 2, hi);

    /* outer dark outline along bottom-right edge */
    pixel(ctx, 6, 4, lo);
    pixel(ctx, 5, 5, lo);
    return canvas;
}

/*
 * Treasure chest pickup. 14x12 wooden chest with iron banding, golden
 * latch, and a soft golden glow rim that suggests the loot inside.
 * The chest is rendered in a slightly raised "ready to open" pose;
 * the actual open animation is a tween in GameScene that scales up
 * and fades out when the upgrade picker launches.
 */
export function paintTreasureChest() {
    const { canvas, ctx } = makeCanvas(14, 12);
    const wood     = '#7a4a1f';
    const woodDk   = '#4a2a10';
    const woodLi   = '#a0682d';
    const iron     = '#3a3a44';
    const ironLi   = '#5e5e6a';
    const gold     = '#f5c54b';
    const goldHi   = '#fff088';

    /* lid arc on top */
    box(ctx, 1, 1, 12, 1, woodDk);
    box(ctx, 2, 0, 10, 1, wood);
    pixel(ctx, 3, 0, woodLi);
    pixel(ctx, 7, 0, woodLi);
    pixel(ctx, 11, 0, woodLi);
    /* lid body */
    box(ctx, 0, 2, 14, 3, wood);
    /* lid highlights */
    box(ctx, 1, 2, 12, 1, woodLi);
    /* iron straps on the lid */
    box(ctx, 3, 1, 1, 4, iron);
    box(ctx, 10, 1, 1, 4, iron);
    pixel(ctx, 3, 2, ironLi);
    pixel(ctx, 10, 2, ironLi);
    /* horizontal seam between lid and body */
    box(ctx, 0, 5, 14, 1, woodDk);
    /* chest body */
    box(ctx, 0, 6, 14, 5, wood);
    box(ctx, 0, 6, 14, 1, woodLi);
    /* iron straps on the body */
    box(ctx, 3, 6, 1, 5, iron);
    box(ctx, 10, 6, 1, 5, iron);
    /* base shadow */
    box(ctx, 0, 11, 14, 1, woodDk);
    /* central golden lock */
    box(ctx, 6, 4, 2, 4, gold);
    pixel(ctx, 6, 4, goldHi);
    pixel(ctx, 7, 7, woodDk);
    /* golden glow rim hint at edges */
    pixel(ctx, 0, 6, goldHi);
    pixel(ctx, 13, 6, goldHi);
    pixel(ctx, 0, 9, goldHi);
    pixel(ctx, 13, 9, goldHi);
    return canvas;
}

/* =========================================================================
 *  PROJECTILES & FX
 * ========================================================================= */

export function paintBoneProjectile() {
    const { canvas, ctx } = makeCanvas(10, 10);
    box(ctx, 1, 4, 8, 2, PALETTE.boneHi);
    box(ctx, 1, 4, 8, 1, PALETTE.boneLo);
    box(ctx, 0, 3, 2, 4, PALETTE.boneMid);
    box(ctx, 8, 3, 2, 4, PALETTE.boneMid);
    pixel(ctx, 1, 3, PALETTE.boneHi);
    pixel(ctx, 8, 3, PALETTE.boneHi);
    pixel(ctx, 0, 6, PALETTE.boneLo);
    pixel(ctx, 9, 6, PALETTE.boneLo);
    return canvas;
}

export function paintSwordArc() {
    const size = 96;
    const { canvas, ctx } = makeCanvas(size, size);
    const cx = size / 2;
    const cy = size / 2;
    const radiusOuter = 44;
    const radiusInner = 22;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dx = x - cx;
            const dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist >= radiusInner && dist <= radiusOuter) {
                const angle = Math.atan2(dy, dx);
                if (angle > -Math.PI / 2 && angle < Math.PI / 2) {
                    const t = Math.abs(angle) / (Math.PI / 2);
                    const ringT = (dist - radiusInner) / (radiusOuter - radiusInner);
                    const fade = (1 - t) * (1 - Math.abs(ringT - 0.5) * 1.6);
                    if (fade > 0.55) {
                        ctx.fillStyle = PALETTE.cyanGlow;
                        ctx.fillRect(x, y, 1, 1);
                    } else if (fade > 0.25) {
                        ctx.fillStyle = PALETTE.cyanGlowDark;
                        ctx.fillRect(x, y, 1, 1);
                    } else if (fade > 0.05) {
                        ctx.fillStyle = '#1d4f8a';
                        ctx.fillRect(x, y, 1, 1);
                    }
                }
            }
        }
    }
    return canvas;
}

export function paintArrow() {
    const W = 14, H = 4;
    const { canvas, ctx } = makeCanvas(W, H);
    box(ctx, 2, 1, 8, 2, PALETTE.leather);
    box(ctx, 2, 1, 8, 1, PALETTE.leatherDark);
    box(ctx, 10, 1, 2, 2, PALETTE.silverMid);
    pixel(ctx, 12, 1, PALETTE.silverHi);
    pixel(ctx, 12, 2, PALETTE.silverHi);
    pixel(ctx, 13, 1, PALETTE.silverMid);
    pixel(ctx, 0, 0, PALETTE.silverMid);
    pixel(ctx, 0, 3, PALETTE.silverMid);
    pixel(ctx, 1, 0, PALETTE.silverMid);
    pixel(ctx, 1, 3, PALETTE.silverMid);
    return canvas;
}

export function paintFireBolt() {
    const W = 12, H = 12;
    const { canvas, ctx } = makeCanvas(W, H);
    const cx = 6, cy = 6;
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const d = Math.hypot(x - cx + 0.5, y - cy + 0.5);
            if (d < 1.4) ctx.fillStyle = PALETTE.fireWhite;
            else if (d < 2.6) ctx.fillStyle = PALETTE.fireYellow;
            else if (d < 4.0) ctx.fillStyle = PALETTE.fireOrange;
            else if (d < 5.0) ctx.fillStyle = PALETTE.fireDeep;
            else continue;
            ctx.fillRect(x, y, 1, 1);
        }
    }
    pixel(ctx, 0, 5, PALETTE.fireDeep);
    pixel(ctx, 0, 6, PALETTE.fireOrange);
    pixel(ctx, 1, 6, PALETTE.fireOrange);
    return canvas;
}

export function paintIceShard() {
    const W = 8, H = 12;
    const { canvas, ctx } = makeCanvas(W, H);
    box(ctx, 3, 0, 2, 2, PALETTE.iceHi);
    box(ctx, 2, 2, 4, 6, PALETTE.iceMid);
    box(ctx, 1, 4, 6, 4, PALETTE.iceMid);
    box(ctx, 2, 8, 4, 3, PALETTE.iceLo);
    pixel(ctx, 3, 1, PALETTE.iceHi);
    pixel(ctx, 4, 3, PALETTE.iceHi);
    pixel(ctx, 3, 5, PALETTE.iceHi);
    pixel(ctx, 4, 7, PALETTE.iceHi);
    pixel(ctx, 3, 11, PALETTE.iceLo);
    return canvas;
}

export function paintHellfireOrb() {
    const W = 14, H = 14;
    const { canvas, ctx } = makeCanvas(W, H);
    const cx = 7, cy = 7;
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const d = Math.hypot(x - cx + 0.5, y - cy + 0.5);
            if (d < 2) ctx.fillStyle = PALETTE.fireWhite;
            else if (d < 3.5) ctx.fillStyle = PALETTE.deathGlowHi;
            else if (d < 5) ctx.fillStyle = PALETTE.deathGlow;
            else if (d < 6.2) ctx.fillStyle = '#3a0a7c';
            else continue;
            ctx.fillRect(x, y, 1, 1);
        }
    }
    pixel(ctx, 1, 6, PALETTE.deathGlow);
    pixel(ctx, 12, 7, PALETTE.deathGlow);
    pixel(ctx, 6, 1, PALETTE.deathGlow);
    pixel(ctx, 7, 12, PALETTE.deathGlow);
    pixel(ctx, 0, 7, '#3a0a7c');
    pixel(ctx, 13, 6, '#3a0a7c');
    return canvas;
}

export function paintMagicBolt() {
    const { canvas, ctx } = makeCanvas(10, 10);
    const cx = 5, cy = 5;
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
            const d = Math.hypot(x - cx + 0.5, y - cy + 0.5);
            if (d < 1.5) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(x, y, 1, 1);
            } else if (d < 2.6) {
                ctx.fillStyle = PALETTE.magicHi;
                ctx.fillRect(x, y, 1, 1);
            } else if (d < 3.8) {
                ctx.fillStyle = PALETTE.magicCore;
                ctx.fillRect(x, y, 1, 1);
            } else if (d < 4.6) {
                ctx.fillStyle = PALETTE.magicLo;
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
    return canvas;
}

export function paintDagger() {
    const W = 14, H = 4;
    const { canvas, ctx } = makeCanvas(W, H);
    box(ctx, 0, 1, 9, 2, PALETTE.silverHi);
    box(ctx, 0, 1, 9, 1, PALETTE.silverMid);
    pixel(ctx, 0, 1, PALETTE.cyanGlow);
    pixel(ctx, 0, 2, PALETTE.cyanGlowDark);
    box(ctx, 9, 0, 1, 4, PALETTE.gold);
    pixel(ctx, 9, 0, PALETTE.goldDark);
    pixel(ctx, 9, 3, PALETTE.goldDark);
    box(ctx, 10, 1, 4, 2, PALETTE.leather);
    pixel(ctx, 13, 1, PALETTE.leatherDark);
    pixel(ctx, 13, 2, PALETTE.leatherDark);
    return canvas;
}

export function paintHolyAura() {
    const size = 100;
    const { canvas, ctx } = makeCanvas(size, size);
    const cx = (size - 1) / 2;
    const cy = (size - 1) / 2;
    const radius = size / 2;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dx = x - cx;
            const dy = y - cy;
            const d = Math.sqrt(dx * dx + dy * dy);
            const t = d / radius;
            if (t > 1.0) continue;
            if (t > 0.94) {
                ctx.fillStyle = PALETTE.auraHi;
                ctx.fillRect(x, y, 1, 1);
            } else if (t > 0.86) {
                ctx.fillStyle = PALETTE.auraMid;
                ctx.fillRect(x, y, 1, 1);
            } else if (t > 0.55) {
                if (((x + y) & 3) === 0) {
                    ctx.fillStyle = PALETTE.auraLo;
                    ctx.fillRect(x, y, 1, 1);
                }
            } else if (t > 0.2) {
                if (((x * 7 + y * 3) & 7) === 0) {
                    ctx.fillStyle = PALETTE.auraLo;
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
    }
    return canvas;
}

export function paintShadow(width) {
    const h = Math.max(3, Math.round(width * 0.32));
    const { canvas, ctx } = makeCanvas(width, h);
    const cx = (width - 1) / 2;
    const cy = (h - 1) / 2;
    const rx = width / 2 - 0.5;
    const ry = h / 2 - 0.5;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < width; x++) {
            const nx = (x - cx) / rx;
            const ny = (y - cy) / ry;
            if (nx * nx + ny * ny <= 1.0) {
                ctx.fillStyle = 'rgba(0,0,0,0.55)';
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
    return canvas;
}

/* =========================================================================
 *  GROUND TILE
 * ========================================================================= */

export function paintCobblestone() {
    const SIZE = 32;
    const { canvas, ctx } = makeCanvas(SIZE, SIZE);
    box(ctx, 0, 0, SIZE, SIZE, PALETTE.cobbleMid);

    const stones = [
        [0, 0, 10, 8],
        [10, 0, 12, 6],
        [22, 0, 10, 8],
        [0, 8, 6, 8],
        [6, 6, 12, 10],
        [18, 6, 14, 10],
        [0, 16, 14, 8],
        [14, 16, 8, 12],
        [22, 16, 10, 8],
        [0, 24, 12, 8],
        [12, 24, 14, 8],
        [26, 24, 6, 8]
    ];
    for (const [x, y, w, h] of stones) {
        const variant = (x * 31 + y * 17) % 3;
        const fill = variant === 0 ? PALETTE.cobbleHi : variant === 1 ? PALETTE.cobbleMid : PALETTE.cobbleLo;
        outlinedBox(ctx, x, y, w, h, fill, PALETTE.cobbleEdge);
        if (variant === 0) {
            pixel(ctx, x + 1, y + 1, PALETTE.silverLo);
            pixel(ctx, x + 2, y + 2, PALETTE.silverLo);
        }
    }

    return canvas;
}

/* =========================================================================
 *  ALTERNATE GROUND TILES
 * ========================================================================= */

/* Deterministic pseudo-random per pixel so tiles look organic but tile cleanly. */
function noise2(x, y) {
    return ((x * 1973 + y * 9277 + 7919) >>> 0) % 100;
}

export function paintGrass() {
    const SIZE = 32;
    const { canvas, ctx } = makeCanvas(SIZE, SIZE);
    box(ctx, 0, 0, SIZE, SIZE, PALETTE.grassMid);

    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const n = noise2(x, y);
            if (n < 18) pixel(ctx, x, y, PALETTE.grassHi);
            else if (n < 28) pixel(ctx, x, y, PALETTE.grassLo);
            else if (n < 30) pixel(ctx, x, y, PALETTE.earth);
        }
    }

    const blades = [
        [3, 5], [9, 2], [17, 7], [25, 4], [29, 12], [6, 14], [13, 18], [21, 21],
        [4, 24], [27, 27], [11, 28], [19, 11], [2, 19], [24, 16]
    ];
    for (const [bx, by] of blades) {
        pixel(ctx, bx, by, PALETTE.bladeHi);
        pixel(ctx, bx, by + 1, PALETTE.grassHi);
        pixel(ctx, bx + 1, by + 1, PALETTE.grassHi);
        pixel(ctx, bx, by + 2, PALETTE.grassMid);
    }

    return canvas;
}

export function paintSwampMud() {
    const SIZE = 32;
    const { canvas, ctx } = makeCanvas(SIZE, SIZE);
    box(ctx, 0, 0, SIZE, SIZE, PALETTE.mudMid);

    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const n = noise2(x + 17, y + 9);
            if (n < 12) pixel(ctx, x, y, PALETTE.mudHi);
            else if (n < 24) pixel(ctx, x, y, PALETTE.mudLo);
            else if (n < 28) pixel(ctx, x, y, PALETTE.swampMoss);
        }
    }

    const puddles = [
        [4, 6, 7, 4],
        [18, 14, 9, 5],
        [9, 22, 6, 4]
    ];
    for (const [px, py, pw, ph] of puddles) {
        for (let y = 0; y < ph; y++) {
            for (let x = 0; x < pw; x++) {
                const cx = (x - (pw - 1) / 2) / ((pw - 1) / 2);
                const cy = (y - (ph - 1) / 2) / ((ph - 1) / 2);
                if (cx * cx + cy * cy <= 1) {
                    const c = (y === 0 || y === ph - 1) ? PALETTE.swampWaterHi : PALETTE.swampWater;
                    pixel(ctx, px + x, py + y, c);
                }
            }
        }
        pixel(ctx, px + 1, py + 1, PALETTE.swampWaterHi);
        pixel(ctx, px + 2, py + 1, PALETTE.swampWaterHi);
    }

    for (let i = 0; i < 12; i++) {
        const x = (i * 7 + 3) % 32;
        const y = (i * 11 + 5) % 32;
        pixel(ctx, x, y, PALETTE.swampMoss);
    }

    return canvas;
}

export function paintWoodFloor() {
    const SIZE = 32;
    const { canvas, ctx } = makeCanvas(SIZE, SIZE);
    box(ctx, 0, 0, SIZE, SIZE, PALETTE.woodMid);

    for (let plankY = 0; plankY < 4; plankY++) {
        const py = plankY * 8;
        const offset = plankY % 2 === 0 ? 0 : 4;

        for (let xx = 0; xx < SIZE; xx++) {
            const inPlank = ((xx + offset) % 16);
            if (inPlank === 0 || inPlank === 15) {
                box(ctx, xx, py, 1, 8, PALETTE.woodEdge);
            }
        }

        box(ctx, 0, py, SIZE, 1, PALETTE.woodEdge);
        box(ctx, 0, py + 7, SIZE, 1, PALETTE.woodLo);

        for (let xx = 0; xx < SIZE; xx++) {
            const n = noise2(xx, py);
            if (n < 8) pixel(ctx, xx, py + 1 + (n % 5), PALETTE.woodHi);
            else if (n < 18) pixel(ctx, xx, py + 1 + (n % 5), PALETTE.woodGrain);
        }

        for (let xx = 0; xx < SIZE; xx += 16) {
            const cx = xx + (offset === 0 ? 4 : 8);
            pixel(ctx, cx, py + 3, PALETTE.woodEdge);
            pixel(ctx, cx, py + 4, PALETTE.woodEdge);
        }
    }

    return canvas;
}

/* =========================================================================
 *  OBSTACLES
 * ========================================================================= */

/*
 * Obstacle painters return {canvas, baseY, bodyW, bodyH}. baseY is the
 * y-coordinate (within the canvas) of the obstacle's "ground line" - we
 * Y-sort against this so the player can walk in front/behind correctly.
 * bodyW/bodyH define the physics body footprint (e.g. just the trunk for a
 * tree, not the leafy crown).
 */

export function paintTree() {
    const W = 28;
    const H = 44;
    const { canvas, ctx } = makeCanvas(W, H);

    box(ctx, 12, 30, 4, 14, PALETTE.barkMid);
    box(ctx, 11, 30, 1, 14, PALETTE.barkLo);
    box(ctx, 16, 30, 1, 14, PALETTE.barkLo);
    box(ctx, 12, 30, 1, 14, PALETTE.barkHi);
    pixel(ctx, 12, 32, PALETTE.barkLo);
    pixel(ctx, 14, 36, PALETTE.barkLo);
    pixel(ctx, 13, 40, PALETTE.barkLo);

    box(ctx, 10, 42, 8, 1, PALETTE.barkEdge);
    box(ctx, 9, 43, 10, 1, PALETTE.barkEdge);

    const crown = [
        [10, 0, 8, 4],
        [6, 2, 16, 4],
        [4, 6, 20, 6],
        [2, 10, 24, 8],
        [4, 18, 20, 6],
        [6, 22, 16, 4],
        [10, 26, 8, 3]
    ];
    for (const [x, y, w, h] of crown) box(ctx, x, y, w, h, PALETTE.leafMid);

    const hi = [
        [11, 1, 4, 1], [8, 3, 6, 1], [5, 7, 8, 1], [3, 11, 10, 1],
        [4, 15, 8, 1], [6, 19, 10, 1], [9, 23, 8, 1], [11, 26, 4, 1]
    ];
    for (const [x, y, w, h] of hi) box(ctx, x, y, w, h, PALETTE.leafHi);

    const lo = [
        [16, 4, 4, 1], [18, 8, 5, 1], [20, 12, 4, 1], [18, 16, 6, 1],
        [16, 20, 5, 1], [14, 24, 6, 1], [13, 27, 4, 1]
    ];
    for (const [x, y, w, h] of lo) box(ctx, x, y, w, h, PALETTE.leafLo);

    box(ctx, 2, 8, 1, 12, PALETTE.leafEdge);
    box(ctx, 25, 8, 1, 12, PALETTE.leafEdge);
    box(ctx, 4, 4, 1, 4, PALETTE.leafEdge);
    box(ctx, 23, 4, 1, 4, PALETTE.leafEdge);
    box(ctx, 4, 22, 1, 4, PALETTE.leafEdge);
    box(ctx, 23, 22, 1, 4, PALETTE.leafEdge);
    box(ctx, 9, 26, 1, 1, PALETTE.leafEdge);
    box(ctx, 18, 26, 1, 1, PALETTE.leafEdge);

    canvas.baseY = 43;
    canvas.bodyW = 8;
    canvas.bodyH = 6;
    return canvas;
}

export function paintDeadTree() {
    const W = 24;
    const H = 40;
    const { canvas, ctx } = makeCanvas(W, H);

    box(ctx, 11, 6, 3, 32, PALETTE.deadBarkMid);
    box(ctx, 10, 6, 1, 32, PALETTE.deadBarkHi);
    box(ctx, 14, 6, 1, 32, PALETTE.deadBarkLo);
    box(ctx, 11, 38, 3, 1, PALETTE.barkEdge);

    box(ctx, 9, 39, 7, 1, PALETTE.barkEdge);

    box(ctx, 5, 14, 6, 1, PALETTE.deadBarkMid);
    box(ctx, 5, 13, 1, 1, PALETTE.deadBarkLo);
    box(ctx, 4, 14, 1, 1, PALETTE.deadBarkHi);
    box(ctx, 5, 15, 1, 1, PALETTE.deadBarkLo);

    box(ctx, 14, 10, 6, 1, PALETTE.deadBarkMid);
    box(ctx, 19, 9, 1, 1, PALETTE.deadBarkLo);
    box(ctx, 20, 10, 1, 1, PALETTE.deadBarkHi);
    box(ctx, 19, 11, 1, 1, PALETTE.deadBarkLo);

    box(ctx, 6, 6, 4, 1, PALETTE.deadBarkLo);
    box(ctx, 4, 7, 1, 4, PALETTE.deadBarkLo);
    box(ctx, 3, 11, 1, 1, PALETTE.deadBarkLo);

    box(ctx, 14, 4, 5, 1, PALETTE.deadBarkLo);
    box(ctx, 19, 5, 1, 3, PALETTE.deadBarkLo);

    box(ctx, 11, 0, 3, 7, PALETTE.deadBarkMid);
    box(ctx, 10, 0, 1, 7, PALETTE.deadBarkHi);
    box(ctx, 14, 0, 1, 7, PALETTE.deadBarkLo);

    pixel(ctx, 8, 22, PALETTE.deathGlow);
    pixel(ctx, 8, 23, PALETTE.deathArmor);
    pixel(ctx, 16, 28, PALETTE.deathGlow);

    canvas.baseY = 39;
    canvas.bodyW = 6;
    canvas.bodyH = 5;
    return canvas;
}

export function paintRock() {
    const W = 22;
    const H = 16;
    const { canvas, ctx } = makeCanvas(W, H);

    const shape = [
        [4, 2, 14, 2],
        [2, 4, 18, 2],
        [1, 6, 20, 4],
        [2, 10, 18, 3],
        [4, 13, 14, 2]
    ];
    for (const [x, y, w, h] of shape) box(ctx, x, y, w, h, PALETTE.rockMid);

    const hi = [
        [4, 2, 8, 1], [2, 4, 10, 1], [1, 6, 12, 1], [2, 10, 8, 1]
    ];
    for (const [x, y, w, h] of hi) box(ctx, x, y, w, h, PALETTE.rockHi);

    const lo = [
        [12, 13, 6, 1], [11, 12, 9, 1], [13, 11, 7, 1], [16, 9, 4, 1]
    ];
    for (const [x, y, w, h] of lo) box(ctx, x, y, w, h, PALETTE.rockLo);

    box(ctx, 4, 1, 14, 1, PALETTE.rockEdge);
    box(ctx, 2, 3, 18, 1, PALETTE.rockEdge);
    box(ctx, 1, 5, 20, 1, PALETTE.rockEdge);
    box(ctx, 4, 14, 14, 1, PALETTE.rockEdge);
    box(ctx, 0, 6, 1, 4, PALETTE.rockEdge);
    box(ctx, 21, 6, 1, 4, PALETTE.rockEdge);

    pixel(ctx, 7, 5, PALETTE.rockEdge);
    pixel(ctx, 14, 7, PALETTE.rockEdge);
    pixel(ctx, 9, 11, PALETTE.rockEdge);
    pixel(ctx, 5, 8, PALETTE.rockHi);

    canvas.baseY = 14;
    canvas.bodyW = 18;
    canvas.bodyH = 8;
    return canvas;
}

export function paintBookshelf() {
    const W = 28;
    const H = 40;
    const { canvas, ctx } = makeCanvas(W, H);

    outlinedBox(ctx, 0, 0, W, H, PALETTE.woodMid, PALETTE.woodEdge);
    box(ctx, 1, 1, 1, H - 2, PALETTE.woodHi);
    box(ctx, W - 2, 1, 1, H - 2, PALETTE.woodLo);

    box(ctx, 1, 1, W - 2, 2, PALETTE.woodHi);
    box(ctx, 1, H - 3, W - 2, 2, PALETTE.woodLo);

    const shelfYs = [10, 20, 30];
    for (const sy of shelfYs) {
        box(ctx, 2, sy, W - 4, 1, PALETTE.woodEdge);
        box(ctx, 2, sy + 1, W - 4, 1, PALETTE.woodHi);
    }

    const shelves = [
        { y: 4, books: [
            { w: 2, h: 6, c: PALETTE.bookA },
            { w: 1, h: 5, c: PALETTE.bookB },
            { w: 2, h: 6, c: PALETTE.bookC },
            { w: 1, h: 5, c: PALETTE.bookD },
            { w: 2, h: 6, c: PALETTE.bookE },
            { w: 1, h: 4, c: PALETTE.bookA },
            { w: 2, h: 6, c: PALETTE.bookB },
            { w: 1, h: 5, c: PALETTE.bookC },
            { w: 2, h: 5, c: PALETTE.bookD },
            { w: 1, h: 4, c: PALETTE.bookE },
            { w: 2, h: 6, c: PALETTE.bookA }
        ] },
        { y: 14, books: [
            { w: 2, h: 5, c: PALETTE.bookB },
            { w: 1, h: 4, c: PALETTE.bookA },
            { w: 2, h: 6, c: PALETTE.bookE },
            { w: 1, h: 5, c: PALETTE.bookC },
            { w: 1, h: 5, c: PALETTE.bookD },
            { w: 2, h: 6, c: PALETTE.bookA },
            { w: 1, h: 4, c: PALETTE.bookB },
            { w: 2, h: 6, c: PALETTE.bookE },
            { w: 1, h: 5, c: PALETTE.bookC },
            { w: 2, h: 5, c: PALETTE.bookD },
            { w: 1, h: 4, c: PALETTE.bookA }
        ] },
        { y: 24, books: [
            { w: 2, h: 6, c: PALETTE.bookC },
            { w: 1, h: 5, c: PALETTE.bookD },
            { w: 2, h: 6, c: PALETTE.bookB },
            { w: 1, h: 4, c: PALETTE.bookE },
            { w: 1, h: 5, c: PALETTE.bookA },
            { w: 2, h: 6, c: PALETTE.bookD },
            { w: 1, h: 4, c: PALETTE.bookC },
            { w: 2, h: 6, c: PALETTE.bookB },
            { w: 1, h: 5, c: PALETTE.bookE },
            { w: 2, h: 6, c: PALETTE.bookA },
            { w: 1, h: 4, c: PALETTE.bookB }
        ] }
    ];

    for (const { y, books } of shelves) {
        let x = 3;
        for (const b of books) {
            if (x + b.w > W - 3) break;
            const top = y + (6 - b.h);
            box(ctx, x, top, b.w, b.h, b.c);
            box(ctx, x, top, 1, b.h, PALETTE.bookSpine);
            box(ctx, x + b.w - 1, top, 1, b.h, PALETTE.bookSpine);
            box(ctx, x, top, b.w, 1, PALETTE.bookSpine);
            if (b.w === 2 && b.h >= 5) pixel(ctx, x, top + 2, PALETTE.brass);
            x += b.w;
        }
    }

    box(ctx, 4, 33, 4, 4, PALETTE.bookA);
    pixel(ctx, 5, 35, PALETTE.brass);
    pixel(ctx, 6, 35, PALETTE.brass);
    box(ctx, 9, 32, 6, 5, PALETTE.bookE);
    pixel(ctx, 10, 33, PALETTE.brassHi);
    box(ctx, 16, 33, 5, 4, PALETTE.bookB);
    box(ctx, 22, 32, 4, 5, PALETTE.bookD);

    canvas.baseY = H - 1;
    canvas.bodyW = W - 4;
    canvas.bodyH = 8;
    return canvas;
}

/*
 * Library desk - wide, low writing table with two drawers, four legs,
 * and a few period-appropriate props on top (book stack, ink pot,
 * candle). Collision footprint hugs the legs+lower apron so the
 * player can step right up to the desk edge.
 */
export function paintDesk() {
    const W = 28;
    const H = 22;
    const { canvas, ctx } = makeCanvas(W, H);

    /* ---- props on top (rows 0-7) ---- */
    /* Book stack on the left */
    box(ctx, 3, 6, 6, 2, PALETTE.bookA);
    box(ctx, 3, 6, 1, 2, PALETTE.bookSpine);
    box(ctx, 8, 6, 1, 2, PALETTE.bookSpine);
    box(ctx, 4, 4, 5, 2, PALETTE.bookC);
    box(ctx, 4, 4, 1, 2, PALETTE.bookSpine);
    box(ctx, 8, 4, 1, 2, PALETTE.bookSpine);
    pixel(ctx, 6, 4, PALETTE.brass);

    /* Ink pot in the middle */
    box(ctx, 12, 4, 4, 4, '#15173a');
    box(ctx, 12, 4, 4, 1, '#2c2f5a');
    pixel(ctx, 12, 4, '#444777');
    pixel(ctx, 13, 5, '#5e62a0');
    /* Quill leaning out of the pot */
    pixel(ctx, 16, 3, '#f4f0d8');
    pixel(ctx, 17, 2, '#f4f0d8');
    pixel(ctx, 18, 1, '#f4f0d8');
    pixel(ctx, 19, 0, '#dcd6b0');

    /* Candle on the right */
    pixel(ctx, 22, 0, '#fff1a0'); /* flame tip */
    pixel(ctx, 22, 1, '#ffa840'); /* flame body */
    pixel(ctx, 23, 1, '#ffa840');
    box(ctx, 22, 2, 2, 4, '#f4ead2'); /* wax */
    pixel(ctx, 22, 2, '#c8be9b');
    box(ctx, 21, 6, 4, 1, PALETTE.brass); /* dish */
    box(ctx, 21, 7, 4, 1, PALETTE.woodLo);

    /* ---- desk top slab (rows 8-11) ---- */
    box(ctx, 0, 8, W, 4, PALETTE.woodMid);
    box(ctx, 0, 8, W, 1, PALETTE.woodHi);
    box(ctx, 0, 11, W, 1, PALETTE.woodLo);
    pixel(ctx, 0, 8, PALETTE.woodEdge);
    pixel(ctx, W - 1, 8, PALETTE.woodEdge);

    /* ---- apron with drawers (rows 12-17) ---- */
    box(ctx, 1, 12, W - 2, 6, PALETTE.woodMid);
    box(ctx, 1, 12, W - 2, 1, PALETTE.woodHi);
    box(ctx, 1, 17, W - 2, 1, PALETTE.woodLo);
    box(ctx, 1, 12, 1, 6, PALETTE.woodEdge);
    box(ctx, W - 2, 12, 1, 6, PALETTE.woodEdge);

    /* Drawer divider (centered vertical seam) */
    box(ctx, W / 2 - 1, 12, 1, 6, PALETTE.woodEdge);
    box(ctx, W / 2, 12, 1, 6, PALETTE.woodHi);

    /* Drawer pulls - brass nubs centered in each drawer */
    const pullY = 14;
    const leftPullX = Math.floor((W / 2 - 2) / 2) + 1;
    const rightPullX = Math.floor(W / 2) + Math.floor((W / 2 - 2) / 2) + 1;
    box(ctx, leftPullX - 1, pullY, 2, 1, PALETTE.brass);
    pixel(ctx, leftPullX - 1, pullY, PALETTE.brassHi);
    box(ctx, rightPullX - 1, pullY, 2, 1, PALETTE.brass);
    pixel(ctx, rightPullX - 1, pullY, PALETTE.brassHi);

    /* ---- legs (rows 18-21) ---- */
    box(ctx, 2, 18, 3, 4, PALETTE.woodLo);
    box(ctx, W - 5, 18, 3, 4, PALETTE.woodLo);
    pixel(ctx, 2, 18, PALETTE.woodMid);
    pixel(ctx, W - 5, 18, PALETTE.woodMid);
    pixel(ctx, 4, 21, PALETTE.woodEdge);
    pixel(ctx, W - 3, 21, PALETTE.woodEdge);

    canvas.baseY = H - 1;
    canvas.bodyW = W - 4;
    canvas.bodyH = 9;
    return canvas;
}

export function paintCandelabra() {
    const W = 14;
    const H = 28;
    const { canvas, ctx } = makeCanvas(W, H);

    box(ctx, 4, 24, 6, 1, PALETTE.brassDk);
    box(ctx, 3, 25, 8, 1, PALETTE.brassDk);
    box(ctx, 2, 26, 10, 2, PALETTE.brass);
    box(ctx, 2, 26, 10, 1, PALETTE.brassHi);
    box(ctx, 1, 27, 12, 1, PALETTE.brassDk);

    box(ctx, 6, 12, 2, 12, PALETTE.brass);
    box(ctx, 6, 12, 1, 12, PALETTE.brassHi);
    box(ctx, 7, 12, 1, 12, PALETTE.brassDk);

    box(ctx, 2, 12, 10, 1, PALETTE.brass);
    box(ctx, 2, 12, 1, 1, PALETTE.brassHi);
    box(ctx, 11, 12, 1, 1, PALETTE.brassDk);
    box(ctx, 6, 13, 2, 1, PALETTE.brassDk);

    box(ctx, 2, 9, 1, 3, PALETTE.brass);
    box(ctx, 2, 9, 1, 1, PALETTE.brassHi);
    box(ctx, 11, 9, 1, 3, PALETTE.brass);
    box(ctx, 11, 9, 1, 1, PALETTE.brassHi);

    box(ctx, 1, 7, 3, 2, PALETTE.brassDk);
    box(ctx, 10, 7, 3, 2, PALETTE.brassDk);
    box(ctx, 5, 16, 4, 2, PALETTE.brassDk);

    box(ctx, 1, 6, 3, 1, PALETTE.candleWax);
    box(ctx, 10, 6, 3, 1, PALETTE.candleWax);
    box(ctx, 5, 15, 4, 1, PALETTE.candleWax);
    box(ctx, 1, 7, 1, 1, PALETTE.candleWaxLo);
    box(ctx, 10, 7, 1, 1, PALETTE.candleWaxLo);
    box(ctx, 5, 16, 1, 1, PALETTE.candleWaxLo);

    box(ctx, 1, 4, 3, 2, PALETTE.candleWax);
    box(ctx, 10, 4, 3, 2, PALETTE.candleWax);
    box(ctx, 5, 13, 4, 2, PALETTE.candleWax);
    pixel(ctx, 1, 5, PALETTE.candleWaxLo);
    pixel(ctx, 10, 5, PALETTE.candleWaxLo);
    pixel(ctx, 5, 14, PALETTE.candleWaxLo);

    pixel(ctx, 2, 3, PALETTE.flameDk);
    pixel(ctx, 11, 3, PALETTE.flameDk);
    pixel(ctx, 6, 12, PALETTE.flameDk);

    pixel(ctx, 2, 2, PALETTE.flame);
    pixel(ctx, 2, 1, PALETTE.flameMid);
    pixel(ctx, 11, 2, PALETTE.flame);
    pixel(ctx, 11, 1, PALETTE.flameMid);
    pixel(ctx, 6, 11, PALETTE.flame);

    canvas.baseY = H - 1;
    canvas.bodyW = 8;
    canvas.bodyH = 4;
    return canvas;
}

export function paintCrate() {
    const W = 18;
    const H = 18;
    const { canvas, ctx } = makeCanvas(W, H);

    outlinedBox(ctx, 0, 1, W, H - 1, PALETTE.crateMid, PALETTE.crateEdge);
    box(ctx, 1, 2, 1, H - 3, PALETTE.crateHi);
    box(ctx, W - 2, 2, 1, H - 3, PALETTE.crateLo);
    box(ctx, 1, 2, W - 2, 1, PALETTE.crateHi);
    box(ctx, 1, H - 2, W - 2, 1, PALETTE.crateLo);

    box(ctx, 0, 5, W, 1, PALETTE.crateBand);
    box(ctx, 0, 12, W, 1, PALETTE.crateBand);
    box(ctx, 0, 6, W, 1, PALETTE.crateEdge);
    box(ctx, 0, 13, W, 1, PALETTE.crateEdge);

    box(ctx, 8, 1, 2, H - 2, PALETTE.crateBand);
    box(ctx, 7, 1, 1, H - 2, PALETTE.crateEdge);
    box(ctx, 10, 1, 1, H - 2, PALETTE.crateEdge);

    pixel(ctx, 4, 4, PALETTE.crateEdge);
    pixel(ctx, 13, 4, PALETTE.crateEdge);
    pixel(ctx, 4, 11, PALETTE.crateEdge);
    pixel(ctx, 13, 11, PALETTE.crateEdge);
    pixel(ctx, 4, 16, PALETTE.crateEdge);
    pixel(ctx, 13, 16, PALETTE.crateEdge);

    pixel(ctx, 3, 8, PALETTE.crateLo);
    pixel(ctx, 14, 9, PALETTE.crateLo);

    canvas.baseY = H - 1;
    canvas.bodyW = W - 2;
    canvas.bodyH = 7;
    return canvas;
}
