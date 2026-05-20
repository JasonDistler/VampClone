import { Enemy } from '../Enemy.js';

export class OrcBrute extends Enemy {
    constructor(scene, x, y) {
        super(scene, x, y, {
            id: 'orc',
            texture: 'orc_0',
            walkAnim: 'orc_walk',
            hp: 75,
            speed: 45,
            contactDamage: 18,
            gemTier: 2,
            shadowKey: 'shadow_large',
            knockbackResist: 0.7,
            bodyW: 14,
            bodyH: 14,
            bodyOffsetY: 2
        });
    }
}
