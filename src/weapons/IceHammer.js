/*
 * Glacier Maul - Borg's heavy ice hammer. Mechanically a slower, larger,
 * harder-hitting Greatsword with a frost tint and a stronger knockback so
 * Borg's sluggish movement is offset by space-creating impacts.
 */
export class IceHammer {
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

        for (const arc of this.activeArcs) arc.update();
        this.activeArcs = this.activeArcs.filter(a => a.alive);
    }

    swing() {
        const facing = this.player.facing;
        let baseAngle = 0;
        if (facing === 'right') baseAngle = 0;
        else if (facing === 'down') baseAngle = Math.PI / 2;
        else if (facing === 'left') baseAngle = Math.PI;
        else if (facing === 'up') baseAngle = -Math.PI / 2;

        const arc = new IceArc(this.scene, this.player, baseAngle, this.swingSide);
        this.activeArcs.push(arc);
        this.swingSide *= -1;

        // Evolved Glacier's Wrath spawns a circular ice shockwave on
        // every swing - independent of the arc, hits all nearby
        // enemies, freezes them, and is gated to the evolved flag so
        // it doesn't fire pre-evolution.
        if (this.runState.weapon.evolved) {
            this._fireShockwave();
        }
    }

    _fireShockwave() {
        const radius = (this.runState.weapon.arcRadius || 38) * 1.7;
        const damage = this.runState.weapon.damage * 0.5;
        const enemies = this.scene.enemies.getChildren().slice();
        for (const e of enemies) {
            if (!e.active) continue;
            const dx = e.x - this.player.x;
            const dy = (e.y - 4) - this.player.y;
            if (dx * dx + dy * dy <= radius * radius) {
                e.takeDamage(damage, this.player);
                this.scene.applyHitStatuses?.(e, 1.5);
            }
        }
        // Visual: an expanding cyan ring drawn as a temporary Graphics
        // object that scales out and fades over 320ms.
        const ring = this.scene.add.graphics();
        ring.setDepth(this.player.y + 0.5);
        ring.setBlendMode(Phaser.BlendModes.ADD);
        let r = 6;
        const tween = this.scene.tweens.addCounter({
            from: 0, to: 1,
            duration: 320,
            ease: 'Sine.easeOut',
            onUpdate: t => {
                ring.clear();
                const v = t.getValue();
                r = 6 + (radius - 6) * v;
                ring.lineStyle(2, 0xa8e6ff, 1 - v);
                ring.strokeCircle(this.player.x, this.player.y - 2, r);
            },
            onComplete: () => ring.destroy()
        });
    }
}

class IceArc {
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

        this.sprite = scene.add.image(player.x, player.y, scene.runState.weapon.arcTexture || 'sword_arc');
        this.sprite.setOrigin(0.5, 0.5);
        this.sprite.setBlendMode(Phaser.BlendModes.ADD);
        this.sprite.setTint(scene.runState.weapon.arcTint || 0x9be0ff);
        const radius = scene.runState.weapon.arcRadius;
        const scale = (radius * 2) / 96;
        this.sprite.setScale(scale);
        this.sprite.setAlpha(0.95);
        this.sprite.setDepth(player.y + 1);
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
        const knockback = this.runState.weapon.knockback || 200;
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
                const kn = (1 - enemy.knockbackResist) * knockback;
                const d = Math.max(1, dist);
                enemy.knockbackVx += (dx / d) * kn;
                enemy.knockbackVy += (dy / d) * kn;
            }
        }
    }

    destroy() {
        this.alive = false;
        if (this.sprite) this.sprite.destroy();
    }
}
