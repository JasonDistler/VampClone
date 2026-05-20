import { GAME_WIDTH, GAME_HEIGHT } from '../main.js';
import { hudOverlay } from '../ui/HudOverlay.js';
import { audio } from '../systems/AudioSystem.js';
import {
    REGISTRY_CHARACTER_KEY,
    REGISTRY_DIFFICULTY_KEY,
    CHARACTERS,
    CHARACTER_ORDER
} from '../characters/Characters.js';

/*
 * MainMenuScene - manages the main-menu and character-select flow.
 * Phaser-side it just paints a moody backdrop and drives the HTML overlay
 * via hudOverlay. Settings is purely a DOM modal handled inside hudOverlay.
 */
export class MainMenuScene extends Phaser.Scene {
    constructor() {
        super('MainMenuScene');
    }

    create() {
        this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0814).setOrigin(0.5);

        this.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 'cobble')
            .setOrigin(0.5)
            .setAlpha(0.18);

        this.cameras.main.setBackgroundColor('#0a0814');

        this.portraits = this.buildPortraits();

        hudOverlay.hideHud();
        hudOverlay.showMainMenu({
            onStart: () => this.openCharSelect()
        });

        // First-run tutorial: pop the overlay only the very first time
        // a player ever lands on the main menu. The flag is stored in
        // localStorage so subsequent visits skip it; explicit re-display
        // is available later from the help button.
        try {
            const KEY = 'sirVelorianTutorialSeen_v1';
            if (!localStorage.getItem(KEY)) {
                hudOverlay.showTutorial();
                localStorage.setItem(KEY, '1');
            }
        } catch (e) {
            /* localStorage unavailable - silently skip first-run flow */
        }

        /*
         * Menu music starts as soon as the AudioContext is unlocked.
         * Until first user gesture (autoplay policy) this is a no-op,
         * but the moment the player clicks anything (likely "START
         * RUN") the looper kicks in.
         */
        audio.playMusic('menu');
    }

    /*
     * Pre-render every character's portrait into a data URL once, so the
     * DOM <img> in the character-select grid can use it directly. The
     * canvas-textures registered in BootScene already hold the painter
     * output; we just toDataURL them here so HudOverlay never needs to
     * reach across into Phaser's texture manager.
     */
    buildPortraits() {
        const out = {};
        for (const id of CHARACTER_ORDER) {
            const c = CHARACTERS[id];
            const tex = this.textures.get(c.portraitKey);
            const src = tex?.getSourceImage?.();
            if (!src) continue;
            try {
                out[id] = {
                    src: src.toDataURL('image/png'),
                    width: src.width,
                    height: src.height
                };
            } catch (e) {
                // Tainted canvas - fall back to no image. Shouldn't happen
                // since our textures are drawn locally with no foreign data.
            }
        }
        return out;
    }

    openCharSelect() {
        hudOverlay.showCharSelect(this.portraits, {
            onBack: () => hudOverlay.showMainMenu({ onStart: () => this.openCharSelect() }),
            onConfirm: (characterId, runOpts) => this.startRun(characterId, runOpts)
        });
    }

    startRun(characterId, runOpts = {}) {
        this.registry.set(REGISTRY_CHARACTER_KEY, characterId);
        this.registry.set(REGISTRY_DIFFICULTY_KEY, hudOverlay.getDifficulty());
        // Daily / Curse opts are pushed onto the registry so GameScene
        // can read them at run start without needing a constructor arg.
        this.registry.set('dailySeed', runOpts.dailySeed ?? null);
        this.registry.set('activeCurses', runOpts.curses ?? []);

        hudOverlay.hideMainMenu();
        hudOverlay.hideCharSelect();
        hudOverlay.hideSettings();

        this.cameras.main.fadeOut(220, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.stop('UIScene');
            this.scene.stop('GameScene');
            this.scene.stop('GameOverScene');
            this.scene.start('GameScene');
            this.scene.launch('UIScene');
            this.scene.stop('MainMenuScene');
        });
    }
}
