import { hudOverlay } from '../ui/HudOverlay.js';

/*
 * Single source of truth for "is the run paused right now?". Everything
 * (keyboard hotkeys, window blur, the pause modal's Resume button) goes
 * through here so we never end up with the modal showing while the game
 * is still running, or vice versa.
 *
 * Phaser's scene.pause() freezes update + input on the GameScene, so we
 * listen for resume keys on document level instead of the scene.
 */
class PauseManager {
    constructor() {
        this.game = null;
        this.paused = false;
        this.autoPaused = false;
    }

    attach(game) { this.game = game; }

    /*
     * Returns true only when the GameScene is in a state where pause
     * makes sense - i.e. we're actually playing, not in any of the modal
     * scenes (level-up, game-over, main menu).
     */
    canTogglePause() {
        if (!this.game) return false;
        const sm = this.game.scene;
        const gs = sm.getScene('GameScene');
        if (!gs) return false;
        if (sm.isActive('LevelUpScene')) return false;
        if (sm.isActive('GameOverScene')) return false;
        if (sm.isActive('MainMenuScene')) return false;
        const status = gs.sys.settings.status;
        // RUNNING (5) or PAUSED (6) - we want either of those
        if (status !== Phaser.Scenes.RUNNING && status !== Phaser.Scenes.PAUSED) return false;
        return true;
    }

    toggle() {
        if (this.paused) this.resume();
        else this.pause();
    }

    pause(opts = {}) {
        if (this.paused || !this.game) return;
        if (!this.canTogglePause()) return;
        this.paused = true;
        this.autoPaused = !!opts.auto;
        this.game.scene.pause('GameScene');
        hudOverlay.showPause({
            autoPaused: this.autoPaused,
            onResume: () => this.resume(),
            onSettings: () => hudOverlay.showSettings(),
            onMainMenu: () => this.toMenu()
        });
    }

    resume() {
        if (!this.paused || !this.game) return;
        this.paused = false;
        this.autoPaused = false;
        hudOverlay.hidePause();
        this.game.scene.resume('GameScene');
    }

    toMenu() {
        if (!this.game) return;
        this.paused = false;
        this.autoPaused = false;
        const sm = this.game.scene;
        hudOverlay.hidePause();
        sm.stop('UIScene');
        sm.stop('GameScene');
        sm.stop('GameOverScene');
        sm.start('MainMenuScene');
    }
}

export const pauseManager = new PauseManager();
