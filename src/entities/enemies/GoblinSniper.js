import { Enemy } from '../Enemy.js';

export class GoblinSniper extends Enemy {
    constructor(scene, x, y) {
        super(scene, x, y, {
            id: 'goblin_sniper',
            texture: 'goblin_sniper_0',
            walkAnim: 'goblin_sniper_walk',
            hp: 14,
            speed: 70,
            contactDamage: 6,
            gemTier: 1,
            shadowKey: 'shadow_small',
            bodyW: 8,
            bodyH: 10,
            bodyOffsetY: 2
        });
        this.preferredRange = 200;
        this.nextShotAt = scene.time.now + 1000 + Math.random() * 800;
    }

    subUpdate(time) {
        const player = this.scene.player;
        if (!player || !player.active) return;
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const d = Math.hypot(dx, dy);

        if (d < this.preferredRange - 20) {
            this.setVelocity(this.body.velocity.x - (dx / d) * 28, this.body.velocity.y - (dy / d) * 28);
        }

        if (d < 280 && time >= this.nextShotAt) {
            this.scene.spawnEnemyProjectile(this.x, this.y - 4, dx / d, dy / d, {
                texture: 'arrow',
                damage: 9,
                speed: 200,
                lifetimeMs: 1500,
                alignToVelocity: true
            });
            this.nextShotAt = time + 1500 + Math.random() * 700;
        }
    }
}
