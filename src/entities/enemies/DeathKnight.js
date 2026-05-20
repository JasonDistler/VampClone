import { Enemy } from '../Enemy.js';

export class DeathKnight extends Enemy {
    constructor(scene, x, y) {
        super(scene, x, y, {
            id: 'death_knight',
            texture: 'death_knight_0',
            walkAnim: 'death_knight_walk',
            hp: 220,
            speed: 42,
            contactDamage: 22,
            gemTier: 2,
            shadowKey: 'shadow_large',
            knockbackResist: 0.92,
            bodyW: 14,
            bodyH: 16,
            bodyOffsetY: 2
        });
        this.nextBlastAt = scene.time.now + 2500 + Math.random() * 600;
    }

    subUpdate(time) {
        const player = this.scene.player;
        if (!player || !player.active) return;
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const d = Math.hypot(dx, dy);

        if (d < 320 && time >= this.nextBlastAt) {
            this.scene.spawnEnemyProjectile(this.x, this.y - 8, dx / d, dy / d, {
                texture: 'hellfire',
                damage: 18,
                speed: 95,
                lifetimeMs: 3200
            });
            this.nextBlastAt = time + 3200 + Math.random() * 600;
        }
    }
}
