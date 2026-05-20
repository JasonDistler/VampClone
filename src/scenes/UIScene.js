import { GAME_WIDTH, GAME_HEIGHT } from '../main.js';
import { REGISTRY_KEY } from '../systems/RunState.js';
import { hudOverlay } from '../ui/HudOverlay.js';

/*
 * UIScene now just manages on-canvas FX (vignette + damage flash).
 * All readable UI text lives in the HTML overlay so it renders at native
 * viewport resolution.
 */
export class UIScene extends Phaser.Scene {
    constructor() {
        super('UIScene');
    }

    create() {
        this.runState = this.registry.get(REGISTRY_KEY);
        this.lastHp = this.runState ? this.runState.hp : 100;

        this.vignette = this.add.graphics();
        this.drawVignette();

        this.flashOverlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xff3030, 0)
            .setOrigin(0.5, 0.5);

        const game = this.scene.get('GameScene');
        const envName = game?.environmentName || '';
        hudOverlay.showHud(envName);
    }

    drawVignette() {
        const g = this.vignette;
        g.clear();
        const layers = 14;
        for (let i = 0; i < layers; i++) {
            const t = i / layers;
            g.fillStyle(0x000000, 0.05 * (1 - t));
            const inset = Math.floor((1 - t) * 12);
            g.fillRect(inset, inset, GAME_WIDTH - inset * 2, GAME_HEIGHT - inset * 2);
        }
        g.fillStyle(0x000000, 0.45);
        g.fillRect(0, 0, GAME_WIDTH, 4);
        g.fillRect(0, GAME_HEIGHT - 8, GAME_WIDTH, 8);
        g.setDepth(-1);
        g.setBlendMode(Phaser.BlendModes.MULTIPLY);
    }

    update() {
        if (!this.runState) {
            this.runState = this.registry.get(REGISTRY_KEY);
            if (!this.runState) return;
            this.lastHp = this.runState.hp;

            const game = this.scene.get('GameScene');
            const envName = game?.environmentName || '';
            hudOverlay.showHud(envName);
        }
        const rs = this.runState;

        hudOverlay.update(rs);

        if (rs.hp < this.lastHp) {
            this.tweens.killTweensOf(this.flashOverlay);
            this.flashOverlay.setAlpha(0.32);
            this.tweens.add({ targets: this.flashOverlay, alpha: 0, duration: 300 });
        }
        this.lastHp = rs.hp;
    }
}
