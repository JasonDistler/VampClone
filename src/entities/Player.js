import { settings } from '../systems/Settings.js';
import { audio } from '../systems/AudioSystem.js';

/*
 * Player avatar. Configurable via a character definition so the same class
 * works for every selectable hero. Two animation modes are supported:
 *   - directional: 4 facings, each with its own walk anim (Sir Velorian)
 *   - single: one walk anim, sprite flips horizontally based on movement
 *
 * The character definition also drives body size / origin offsets so each
 * sprite has a sensible collision footprint.
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, character) {
        super(scene, x, y, character.sprite.initialKey);
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.character = character;
        const body = character.body;
        this.setSize(body.w, body.h);
        this.setOffset(body.offsetX, body.offsetY);
        this.setCollideWorldBounds(false);
        this.setOrigin(0.5, 0.95);

        this.runState = scene.runState;
        this.facing = 'down';
        this.iframesUntil = 0;
        this.lastDamageBeepAt = 0;
        this.lastDustAt = 0;

        this.shadow = scene.add.image(x, y + 1, character.shadowKey || 'shadow_med');
        this.shadow.setOrigin(0.5, 0.5);
        this.shadow.setAlpha(0.55);

        const a = character.sprite.anims;
        if (character.sprite.directional) {
            this.play(a.down);
        } else {
            this.play(a.walk);
        }
    }

    update(time, dt, input) {
        if (this.runState.gameOver) return;
        const dirX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        const dirY = (input.down ? 1 : 0) - (input.up ? 1 : 0);

        const len = Math.hypot(dirX, dirY) || 1;
        const nx = dirX / len;
        const ny = dirY / len;
        const speed = this.runState.speed;
        this.setVelocity(nx * speed, ny * speed);

        const a = this.character.sprite.anims;
        if (this.character.sprite.directional) {
            this.applyDirectionalAnim(dirX, dirY, a);
        } else {
            this.applySingleAnim(dirX, dirY, a, len);
        }

        // Footstep dust - throttled puff under the feet while moving.
        // Dust is suppressed during hit-stop so it doesn't fire while
        // the world is frozen on a kill.
        const moving = (dirX !== 0 || dirY !== 0);
        if (moving && this.scene.particles && time - this.lastDustAt > 160) {
            this.scene.particles.spawnDust(this.x, this.y);
            this.lastDustAt = time;
        }

        this.shadow.setPosition(this.x, this.y - 1);
        this.setDepth(this.y);
        this.shadow.setDepth(this.y - 0.5);

        if (time < this.iframesUntil) {
            this.setTintFill(0xffffff);
            this.setAlpha(0.6 + 0.4 * Math.sin(time * 0.05));
        } else {
            this.clearTint();
            this.setAlpha(1);
        }
    }

    applyDirectionalAnim(dirX, dirY, a) {
        if (dirX === 0 && dirY === 0) {
            this.anims.stop();
            return;
        }
        if (Math.abs(dirX) >= Math.abs(dirY)) {
            this.facing = dirX > 0 ? 'right' : 'left';
            this.setFlipX(dirX < 0);
            if (this.anims.currentAnim?.key !== a.side) this.play(a.side);
        } else {
            this.facing = dirY > 0 ? 'down' : 'up';
            this.setFlipX(false);
            const animKey = dirY > 0 ? a.down : a.up;
            if (this.anims.currentAnim?.key !== animKey) this.play(animKey);
        }
    }

    applySingleAnim(dirX, dirY, a) {
        if (dirX === 0 && dirY === 0) {
            return;
        }
        if (Math.abs(dirX) >= Math.abs(dirY)) {
            this.facing = dirX > 0 ? 'right' : 'left';
            this.setFlipX(dirX < 0);
        } else {
            this.facing = dirY > 0 ? 'down' : 'up';
        }
        if (this.anims.currentAnim?.key !== a.walk) this.play(a.walk);
    }

    takeDamage(amount, time) {
        if (this.runState.gameOver) return false;
        if (time < this.iframesUntil) return false;
        const dmgMult = this.scene.difficultyMult?.damage ?? 1;
        const cursedMult = this.runState.cursedPlayerDmgMult ?? 1;
        const scaled = amount * dmgMult * cursedMult;
        const reduced = Math.max(1, scaled - this.runState.armor);
        this.runState.hp = Math.max(0, this.runState.hp - reduced);
        // Flawless run achievement is invalidated on first damage taken
        this.runState.flawless = false;
        this.iframesUntil = time + 600;
        if (settings.screenShake) {
            this.scene.cameras.main.shake(120, 0.005);
        }
        if (this.runState.hp <= 0) {
            this.runState.gameOver = true;
            audio.death();
            this.scene.handlePlayerDeath();
        } else {
            audio.playerHit();
        }
        return true;
    }

    heal(amount) {
        this.runState.hp = Math.min(this.runState.maxHp, this.runState.hp + amount);
    }

    destroy(fromScene) {
        if (this.shadow) this.shadow.destroy();
        super.destroy(fromScene);
    }
}
