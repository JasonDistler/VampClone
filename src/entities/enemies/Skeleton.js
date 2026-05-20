import { Enemy } from '../Enemy.js';

export class Skeleton extends Enemy {
    constructor(scene, x, y) {
        super(scene, x, y, {
            id: 'skeleton',
            texture: 'skeleton_0',
            walkAnim: 'skeleton_walk',
            hp: 22,
            speed: 60,
            contactDamage: 8,
            gemTier: 1,
            shadowKey: 'shadow_small',
            bodyW: 10,
            bodyH: 10,
            bodyOffsetY: 2
        });
        this.nextThrowAt = scene.time.now + 1800 + Math.random() * 800;
    }

    subUpdate(time) {
        const player = this.scene.player;
        if (!player || !player.active) return;
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const d = Math.hypot(dx, dy);
        if (d < 220 && time >= this.nextThrowAt) {
            this.scene.spawnEnemyProjectile(this.x, this.y - 6, dx / d, dy / d, {
                texture: 'bone',
                damage: 6,
                speed: 130,
                lifetimeMs: 2400
            });
            this.nextThrowAt = time + 2000 + Math.random() * 800;
        }
    }
}
