import { audio } from '../systems/AudioSystem.js';

/*
 * Lion's Bane - the player's auto-swinging greatsword. Once per cooldown we
 * spawn a transient arc sprite that rotates ~180 degrees around the player.
 * Any enemy whose body overlaps the arc sprite during its lifetime takes
 * damage at most once per swing (tracked via a per-arc Set).
 */
export class Greatsword {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this.runState = scene.runState;

        this.nextSwingAt = 0;
        this.swingSide = 1;
        this.activeArcs = [];
    }

    update(time) {
        if (this.runState.gameOver) return;
        if (time >= this.nextSwingAt) {
            this.swing(time);
            this.nextSwingAt = time + this.runState.weapon.cooldownMs;
        }

        for (const arc of this.activeArcs) {
            arc.update();
        }
        this.activeArcs = this.activeArcs.filter(a => a.alive);
    }

    swing(time) {
        const facing = this.player.facing;
        let baseAngle = 0;
        if (facing === 'right') baseAngle = 0;
        else if (facing === 'down') baseAngle = Math.PI / 2;
        else if (facing === 'left') baseAngle = Math.PI;
        else if (facing === 'up') baseAngle = -Math.PI / 2;

        const arc = new SwordArc(this.scene, this.player, baseAngle, this.swingSide);
        this.activeArcs.push(arc);
        this.swingSide *= -1;
        audio.swordSwing();
    }
}

class SwordArc {
    constructor(scene, player, baseAngle, side) {
        this.scene = scene;
        this.player = player;
        this.runState = scene.runState;
        this.baseAngle = baseAngle;
        this.side = side;
        this.alive = true;
        this.startedAt = scene.time.now;
        this.duration = scene.runState.weapon.sweepDurationMs;
        this.hitSet = new Set();

        this.sprite = scene.add.image(player.x, player.y, 'sword_arc');
        this.sprite.setOrigin(0.5, 0.5);
        this.sprite.setBlendMode(Phaser.BlendModes.ADD);
        const radius = scene.runState.weapon.arcRadius;
        const scale = (radius * 2) / 96;
        this.sprite.setScale(scale);
        this.sprite.setAlpha(0.95);
        this.sprite.setDepth(player.y + 1);

        // Evolved Greatsword (Excalibur Ascendant) tints the sword
        // arc gold and renders larger/brighter to read as the apex form.
        if (this.runState.weapon.evolved) {
            this.sprite.setTint(0xffe066);
            this.sprite.setScale(scale * 1.18);
            this.sprite.setAlpha(1.0);
        }
    }

    update() {
        if (!this.alive) return;
        const t = (this.scene.time.now - this.startedAt) / this.duration;
        if (t >= 1) {
            this.destroy();
            return;
        }

        const arcSweep = Math.PI;
        const angle = this.baseAngle + this.side * (-Math.PI / 2 + arcSweep * t);

        this.sprite.setPosition(this.player.x, this.player.y - 4);
        this.sprite.setRotation(angle);
        this.sprite.setAlpha(0.95 * (1 - t * 0.5));
        this.sprite.setDepth(this.player.y + 1);

        const radius = this.runState.weapon.arcRadius;
        const halfArc = Math.PI / 2;
        const enemies = this.scene.enemies.getChildren().slice();
        for (const enemy of enemies) {
            if (!enemy.active || this.hitSet.has(enemy)) continue;
            const dx = enemy.x - this.player.x;
            const dy = (enemy.y - 4) - this.player.y;
            const dist = Math.hypot(dx, dy);
            if (dist > radius + 6) continue;
            const enemyAngle = Math.atan2(dy, dx);
            const delta = Phaser.Math.Angle.Wrap(enemyAngle - angle);
            if (Math.abs(delta) <= halfArc) {
                this.hitSet.add(enemy);
                const dmg = this.runState.weapon.damage;
                enemy.takeDamage(dmg, this.player);
                this.runState.damageByWeapon.primary += dmg;
                this.scene.applyHitStatuses?.(enemy);
                if (this.runState.lifestealPct > 0) {
                    this.player.heal(Math.max(1, Math.floor(this.runState.weapon.damage * this.runState.lifestealPct)));
                }
            }
        }
    }

    destroy() {
        this.alive = false;
        if (this.sprite) this.sprite.destroy();
    }
}
