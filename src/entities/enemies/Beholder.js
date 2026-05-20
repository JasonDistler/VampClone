import { Enemy } from '../Enemy.js';

export class Beholder extends Enemy {
    constructor(scene, x, y) {
        super(scene, x, y, {
            id: 'beholder',
            texture: 'beholder_0',
            walkAnim: 'beholder_idle',
            hp: 110,
            speed: 38,
            contactDamage: 16,
            gemTier: 2,
            shadowKey: 'shadow_med',
            knockbackResist: 0.85,
            bodyW: 14,
            bodyH: 14,
            bodyOffsetY: 2
        });
        this.preferredRange = 180;
        this.nextBoltAt = scene.time.now + 1500 + Math.random() * 800;
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

        if (d < 320 && time >= this.nextBoltAt) {
            this.scene.spawnEnemyProjectile(this.x, this.y - 4, dx / d, dy / d, {
                texture: 'magic_bolt',
                damage: 14,
                speed: 110,
                lifetimeMs: 3200
            });
            this.nextBoltAt = time + 1700 + Math.random() * 700;
        }
    }
}
