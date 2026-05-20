import { Enemy } from '../Enemy.js';

export class FireElemental extends Enemy {
    constructor(scene, x, y) {
        super(scene, x, y, {
            id: 'fire_elemental',
            texture: 'fire_elemental_0',
            walkAnim: 'fire_elemental_burn',
            hp: 50,
            speed: 70,
            contactDamage: 14,
            gemTier: 2,
            shadowKey: 'shadow_med',
            knockbackResist: 0.3,
            bodyW: 10,
            bodyH: 14,
            bodyOffsetY: 2
        });
        this.preferredRange = 160;
        this.nextBoltAt = scene.time.now + 1200 + Math.random() * 600;
    }

    subUpdate(time) {
        const player = this.scene.player;
        if (!player || !player.active) return;
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const d = Math.hypot(dx, dy);

        if (d < 280 && time >= this.nextBoltAt) {
            this.scene.spawnEnemyProjectile(this.x, this.y - 6, dx / d, dy / d, {
                texture: 'fire_bolt',
                damage: 11,
                speed: 130,
                lifetimeMs: 2200,
                spinDeg: 180
            });
            this.nextBoltAt = time + 1500 + Math.random() * 600;
        }
    }
}
