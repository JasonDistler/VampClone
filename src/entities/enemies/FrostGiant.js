import { Enemy } from '../Enemy.js';

export class FrostGiant extends Enemy {
    constructor(scene, x, y) {
        super(scene, x, y, {
            id: 'frost_giant',
            texture: 'frost_giant_0',
            walkAnim: 'frost_giant_walk',
            hp: 380,
            speed: 28,
            contactDamage: 28,
            gemTier: 2,
            shadowKey: 'shadow_large',
            knockbackResist: 0.95,
            bodyW: 18,
            bodyH: 18,
            bodyOffsetY: 2
        });
        this.nextShardAt = scene.time.now + 3000;
    }

    subUpdate(time) {
        const player = this.scene.player;
        if (!player || !player.active) return;
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const d = Math.hypot(dx, dy);

        if (d < 340 && time >= this.nextShardAt) {
            this.scene.spawnEnemyProjectile(this.x, this.y - 14, dx / d, dy / d, {
                texture: 'ice_shard',
                damage: 22,
                speed: 120,
                lifetimeMs: 3000,
                alignToVelocity: true
            });
            this.nextShardAt = time + 3500 + Math.random() * 500;
        }
    }
}
