import { Enemy } from '../Enemy.js';

export class Zombie extends Enemy {
    constructor(scene, x, y) {
        super(scene, x, y, {
            id: 'zombie',
            texture: 'zombie_0',
            walkAnim: 'zombie_walk',
            hp: 36,
            speed: 38,
            contactDamage: 12,
            gemTier: 1,
            shadowKey: 'shadow_small',
            knockbackResist: 0.4,
            bodyW: 10,
            bodyH: 12,
            bodyOffsetY: 1
        });
    }
}
