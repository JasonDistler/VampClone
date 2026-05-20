import { hudOverlay } from '../ui/HudOverlay.js';
import { bestRuns } from '../systems/BestRuns.js';
import { audio } from '../systems/AudioSystem.js';

export class GameOverScene extends Phaser.Scene {
    constructor() {
        super('GameOverScene');
    }

    init(data) {
        this.runState = data.runState;
        this.restarting = false;
    }

    create() {
        this.restarting = false;
        hudOverlay.hideHud();
        audio.stopMusic();
        hudOverlay.hideBossBanner();
        hudOverlay.hideBossHp();

        const charId = this.runState.characterId || 'velorian';
        const bestInfo = bestRuns.record(charId, {
            level: this.runState.level,
            timeMs: this.runState.elapsedMs,
            kills: this.runState.kills
        });

        hudOverlay.showGameOver(
            this.runState,
            () => this.restart(),
            () => this.toMenu(),
            bestInfo
        );

        this.input.keyboard.once('keydown-SPACE', () => this.restart());
        this.input.keyboard.once('keydown-ENTER', () => this.restart());
        this.input.keyboard.once('keydown-R', () => this.restart());
        this.input.keyboard.once('keydown-ESC', () => this.toMenu());

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => hudOverlay.hideGameOver());
    }

    restart() {
        if (this.restarting) return;
        this.restarting = true;
        hudOverlay.hideGameOver();
        const sm = this.scene.manager;
        sm.stop('UIScene');
        sm.stop('GameScene');
        sm.stop('GameOverScene');
        sm.run('GameScene');
        sm.run('UIScene');
    }

    toMenu() {
        if (this.restarting) return;
        this.restarting = true;
        hudOverlay.hideGameOver();
        const sm = this.scene.manager;
        sm.stop('UIScene');
        sm.stop('GameScene');
        sm.stop('GameOverScene');
        sm.start('MainMenuScene');
    }
}
