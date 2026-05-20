import { settings } from './Settings.js';

/*
 * Player-facing "Graphics" toggle.
 *
 * 'pixel' (default): canvas uses image-rendering: pixelated and all textures
 * use NEAREST sampling - the original crisp retro look.
 *
 * 'hd': canvas switches to bilinear smoothing (image-rendering: auto) AND
 * character/enemy textures get LINEAR filtering. The CSS swap softens how
 * the game canvas is upscaled to the viewport, which is what the player
 * actually sees - characters and enemies look like smoothed HD art rather
 * than a blocky 16x16 grid.
 *
 * We toggle a body[data-graphics] attribute so the rule lives in CSS and
 * we don't need to touch inline canvas styles. The texture filter pass
 * runs after BootScene has registered all canvases as Phaser textures.
 */

const CHARACTER_AND_ENEMY_KEYS = [
    /* Player characters (frame pairs for walk anims) */
    'velorian_down_0', 'velorian_down_1',
    'velorian_up_0', 'velorian_up_1',
    'velorian_side_0', 'velorian_side_1',

    /* Enemies */
    'goblin_0', 'goblin_1',
    'skeleton_0', 'skeleton_1',
    'orc_0', 'orc_1',
    'bat_0', 'bat_1',
    'zombie_0', 'zombie_1',
    'wraith_0', 'wraith_1',
    'beholder_0', 'beholder_1',
    'goblin_sniper_0', 'goblin_sniper_1',
    'goblin_berserker_0', 'goblin_berserker_1',
    'fire_elemental_0', 'fire_elemental_1',
    'necrotech_0', 'necrotech_1',
    'shadowmancer_0', 'shadowmancer_1',
    'death_knight_0', 'death_knight_1',
    'frost_giant_0', 'frost_giant_1',
    'balor_0', 'balor_1'
];

class GraphicsModeController {
    constructor() {
        this.game = null;
        this._bodyAppliedFor = null;
    }

    attach(game) {
        this.game = game;
        this.applyToBody();
    }

    /*
     * Applied at app-load time and on every change, regardless of whether
     * Phaser has finished booting yet. Pure DOM/CSS swap.
     */
    applyToBody() {
        const mode = settings.graphicsMode;
        if (typeof document !== 'undefined' && document.body) {
            document.body.dataset.graphics = mode;
        }
        this._bodyAppliedFor = mode;
    }

    /*
     * Applies the per-texture filter mode. Called after BootScene has
     * registered character and enemy textures, and again whenever the
     * setting flips at runtime. Safe to call before textures exist;
     * unknown keys are skipped.
     */
    applyToTextures() {
        if (!this.game || !this.game.textures || !window.Phaser) return;
        const mode = settings.graphicsMode;
        const FilterMode = window.Phaser.Textures.FilterMode;
        if (!FilterMode) return;
        const filter = mode === 'hd' ? FilterMode.LINEAR : FilterMode.NEAREST;
        for (const key of CHARACTER_AND_ENEMY_KEYS) {
            if (!this.game.textures.exists(key)) continue;
            try {
                this.game.textures.get(key).setFilter(filter);
            } catch (e) {
                /* Phaser may throw on a not-yet-ready texture; ignore. */
            }
        }
    }

    apply() {
        this.applyToBody();
        this.applyToTextures();
    }

    set(mode) {
        const safe = mode === 'hd' ? 'hd' : 'pixel';
        settings.set('graphicsMode', safe);
        this.apply();
    }
}

export const graphicsMode = new GraphicsModeController();
