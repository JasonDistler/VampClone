import { Enemy } from '../Enemy.js';

export class Necrotech extends Enemy {
    constructor(scene, x, y) {
        super(scene, x, y, {
            id: 'necrotech',
            texture: 'necrotech_0',
            walkAnim: 'necrotech_walk',
            hp: 130,
            speed: 35,
            contactDamage: 18,
            gemTier: 2,
            shadowKey: 'shadow_large',
            knockbackResist: 0.85,
            bodyW: 14,
            bodyH: 14,
            bodyOffsetY: 2
        });
        this.lastRegenAt = scene.time.now;
    }

    subUpdate(time) {
        if (time - this.lastRegenAt >= 1000) {
            this.lastRegenAt = time;
            if (this.hp < this.maxHp) {
                this.hp = Math.min(this.maxHp, this.hp + 5);
            }
        }
    }
}
