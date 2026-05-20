import { Enemy } from '../Enemy.js';

export class GoblinBerserker extends Enemy {
    constructor(scene, x, y) {
        super(scene, x, y, {
            id: 'goblin_berserker',
            texture: 'goblin_berserker_0',
            walkAnim: 'goblin_berserker_walk',
            hp: 28,
            speed: 115,
            contactDamage: 12,
            gemTier: 1,
            shadowKey: 'shadow_small',
            knockbackResist: 0.2,
            bodyW: 10,
            bodyH: 10,
            bodyOffsetY: 2
        });
    }
}
