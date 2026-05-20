import { Enemy } from '../Enemy.js';

export class Shadowmancer extends Enemy {
    constructor(scene, x, y) {
        super(scene, x, y, {
            id: 'shadowmancer',
            texture: 'shadowmancer_0',
            walkAnim: 'shadowmancer_float',
            hp: 90,
            speed: 50,
            contactDamage: 14,
            gemTier: 2,
            shadowKey: 'shadow_med',
            knockbackResist: 0.7,
            ignoreSeparation: true,
            bodyW: 12,
            bodyH: 16,
            bodyOffsetY: 2
        });
        this.setAlpha(0.85);
        if (this.shadow) this.shadow.setAlpha(0.3);
        this.preferredRange = 220;
        this.nextBlastAt = scene.time.now + 1500 + Math.random() * 600;
    }

    subUpdate(time) {
        const player = this.scene.player;
        if (!player || !player.active) return;
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const d = Math.hypot(dx, dy);

        if (d < this.preferredRange - 30) {
            this.setVelocity(this.body.velocity.x - (dx / d) * 30, this.body.velocity.y - (dy / d) * 30);
        }

        if (d < 360 && time >= this.nextBlastAt) {
            const baseAngle = Math.atan2(dy, dx);
            for (let i = -1; i <= 1; i++) {
                const angle = baseAngle + i * 0.28;
                this.scene.spawnEnemyProjectile(this.x, this.y - 6, Math.cos(angle), Math.sin(angle), {
                    texture: 'magic_bolt',
                    damage: 9,
                    speed: 130,
                    lifetimeMs: 2400
                });
            }
            this.nextBlastAt = time + 2200 + Math.random() * 700;
        }
    }
}
