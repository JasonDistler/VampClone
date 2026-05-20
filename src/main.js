import { BootScene } from './scenes/BootScene.js';
import { MainMenuScene } from './scenes/MainMenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';
import { LevelUpScene } from './scenes/LevelUpScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { settings } from './systems/Settings.js';
import { pauseManager } from './systems/PauseManager.js';
import { hudOverlay } from './ui/HudOverlay.js';
import { gamepad, GP } from './systems/Gamepad.js';
import { graphicsMode } from './systems/GraphicsMode.js';
import { viewAngle } from './systems/ViewAngle.js';
import { audio } from './systems/AudioSystem.js';

export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 270;

const config = {
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    backgroundColor: '#0a0814',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        zoom: 1
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 0 },
            debug: false
        }
    },
    scene: [BootScene, MainMenuScene, GameScene, UIScene, LevelUpScene, GameOverScene]
};

window.addEventListener('load', () => {
    /*
     * Stamp the graphics mode onto <body> immediately so the canvas's
     * image-rendering CSS rule resolves correctly on its very first paint
     * (no flash of pixelated frames before HD users get their smoothing).
     * Same story for the view-angle attribute: stamp it before Phaser
     * paints so a player who has the 3/4 view enabled doesn't see a
     * single top-down frame on every reload.
     */
    graphicsMode.applyToBody();
    viewAngle.applyToBody();

    /*
     * Install audio: registers one-shot listeners that lazy-create the
     * AudioContext on first user interaction (browser autoplay policy).
     * Sound effects/music can be safely called even before unlock - they
     * no-op until the context exists.
     */
    audio.install();

    const game = new Phaser.Game(config);
    pauseManager.attach(game);
    graphicsMode.attach(game);

    /*
     * Gamepad: poll once per render tick (synchronously, before any
     * scene update) so wasJustPressed() edge-detection is consistent
     * across all subscribers. Then dispatch global hotkey behavior
     * (pause toggle on Start) right after polling so it works even
     * when the only active scene is a modal-style scene.
     */
    gamepad.init();
    game.events.on('prestep', () => {
        gamepad.pollFrame();
        if (!gamepad.connected) return;

        /* Start (Menu/Options) - global pause toggle, mirrors Esc/P/Enter. */
        if (gamepad.wasJustPressed(GP.START)) {
            if (hudOverlay.isSettingsOpen()) {
                hudOverlay.hideSettings();
            } else if (pauseManager.canTogglePause()) {
                pauseManager.toggle();
            }
        }

        /* Pump UI navigation (focus + A/B) for whatever modal is up. */
        hudOverlay.tickGamepadNav();
    });

    /*
     * Global pause hotkeys. We listen on document so the keys work whether
     * GameScene is currently RUNNING or PAUSED (Phaser scene-level input is
     * suspended on pause). PauseManager.canTogglePause() guards against
     * pausing while in menus or modal scenes.
     */
    document.addEventListener('keydown', (e) => {
        const k = e.key;
        const isPauseKey = k === 'Escape' || k === 'Enter' || k === 'p' || k === 'P';
        if (!isPauseKey) return;

        // ESC closes settings if it's open, no matter what's underneath.
        if (k === 'Escape' && hudOverlay.isSettingsOpen()) {
            hudOverlay.hideSettings();
            e.preventDefault();
            return;
        }

        if (!pauseManager.canTogglePause()) return;
        pauseManager.toggle();
        e.preventDefault();
    });

    /*
     * Auto-pause when the window loses focus / tab is hidden, so the
     * player isn't chip-damaged to death by enemies they can't see.
     * Routed through PauseManager so the same pause UI shows.
     */
    const blurPause = () => {
        if (!settings.autoPauseOnBlur) return;
        if (!pauseManager.canTogglePause()) return;
        if (pauseManager.paused) return;
        pauseManager.pause({ auto: true });
    };
    const blurResume = () => {
        if (pauseManager.paused && pauseManager.autoPaused) {
            pauseManager.resume();
        }
    };
    window.addEventListener('blur', blurPause);
    window.addEventListener('focus', blurResume);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) blurPause();
        else blurResume();
    });
});
