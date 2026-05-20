import { settings } from './Settings.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../main.js';

/*
 * Floating damage numbers rendered as crisp HD DOM elements positioned
 * over the Phaser canvas. Each frame we convert world-space coords (where
 * the hit happened) to viewport pixels using the camera scroll and the
 * canvas's current bounding rect. Numbers are always whole integers and
 * styled in bright yellow via the .dmg-num CSS class. Heal popups pass
 * a pre-formatted string like "+12" along with a color hint.
 */
export class DamageNumbers {
    constructor(scene) {
        this.scene = scene;
        this.container = document.getElementById('damage-numbers');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'damage-numbers';
            const host = document.getElementById('game-container') || document.body;
            host.appendChild(this.container);
        }
        this.active = [];
        this.canvas = scene.game.canvas;

        const cleanup = () => this.clearAll();
        scene.events.once('shutdown', cleanup);
        scene.events.once('destroy', cleanup);
    }

    clearAll() {
        for (const n of this.active) n.el.remove();
        this.active.length = 0;
    }

    /*
     * amount: number (will be rounded to a whole number) OR a pre-formatted
     * string (e.g. "+12" for heals) which is rendered verbatim. color is an
     * optional CSS color hint; if it suggests a heal we tag the element so
     * the green heal style applies, otherwise we use the default yellow.
     */
    spawn(x, y, amount, color) {
        if (!settings.damageNumbers) return;
        let text;
        if (typeof amount === 'string') {
            text = amount;
        } else {
            const n = Math.max(0, Math.round(Number(amount) || 0));
            text = String(n);
        }

        const el = document.createElement('div');
        el.className = 'dmg-num';
        if (color) {
            // Heal popups pass a green tint - swap to the .heal class so the
            // outline flips to dark green and the glow matches. Anything else
            // just overrides the inline text color while keeping the dark
            // outline that makes numbers readable on bright backgrounds.
            if (this.isGreenish(color)) {
                el.classList.add('heal');
            } else {
                el.style.color = color;
            }
        }
        el.textContent = text;
        this.container.appendChild(el);

        this.active.push({
            el,
            x0: x,
            y0: y - 4,
            spawnedAt: this.scene.time.now,
            lifetimeMs: 600,
            floatPx: 22
        });
    }

    isGreenish(color) {
        if (!color) return false;
        const c = color.trim().toLowerCase();
        if (c.startsWith('#')) {
            let hex = c.slice(1);
            if (hex.length === 3) hex = hex.split('').map((ch) => ch + ch).join('');
            if (hex.length < 6) return false;
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            return g > 180 && g > r + 30 && g >= b - 20;
        }
        return false;
    }

    update(time) {
        if (this.active.length === 0) return;
        const cam = this.scene.cameras.main;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = rect.width / GAME_WIDTH;
        const scaleY = rect.height / GAME_HEIGHT;

        for (let i = this.active.length - 1; i >= 0; i--) {
            const n = this.active[i];
            const t = (time - n.spawnedAt) / n.lifetimeMs;
            if (t >= 1) {
                n.el.remove();
                this.active.splice(i, 1);
                continue;
            }
            // Float upward in world units so it stays above the enemy as
            // the camera scrolls.
            const worldY = n.y0 - n.floatPx * t;
            const screenX = (n.x0 - cam.scrollX) * scaleX + rect.left;
            const screenY = (worldY - cam.scrollY) * scaleY + rect.top;
            n.el.style.left = screenX + 'px';
            n.el.style.top = screenY + 'px';
            // Quadratic ease-out fade.
            n.el.style.opacity = String(1 - t * t);
        }
    }
}
