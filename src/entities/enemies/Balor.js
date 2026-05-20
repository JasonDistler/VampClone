import { Enemy } from '../Enemy.js';

export class Balor extends Enemy {
    constructor(scene, x, y) {
        super(scene, x, y, {
            id: 'balor',
            texture: 'balor_0',
            walkAnim: 'balor_fly',
            hp: 500,
            speed: 60,
            contactDamage: 30,
            gemTier: 2,
            shadowKey: 'shadow_large',
            knockbackResist: 0.95,
            ignoreSeparation: true,
            bodyW: 16,
            bodyH: 18,
            bodyOffsetY: 2
        });
        if (this.shadow) this.shadow.setAlpha(0.4);
        this.nextWhipAt = scene.time.now + 1800;
    }

    subUpdate(time) {
        const player = this.scene.player;
        if (!player || !player.active) return;
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const d = Math.hypot(dx, dy);

        if (d < 380 && time >= this.nextWhipAt) {
            const baseAngle = Math.atan2(dy, dx);
            for (let i = -1; i <= 1; i++) {
                const angle = baseAngle + i * 0.22;
                this.scene.spawnEnemyProjectile(this.x, this.y - 6, Math.cos(angle), Math.sin(angle), {
                    texture: 'fire_bolt',
                    damage: 14,
                    speed: 110,
                    lifetimeMs: 3000,
                    spinDeg: 240
                });
            }
            this.nextWhipAt = time + 2400 + Math.random() * 400;
        }
    }
}
