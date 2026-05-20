import { Enemy } from '../Enemy.js';

export class Goblin extends Enemy {
    constructor(scene, x, y) {
        super(scene, x, y, {
            id: 'goblin',
            texture: 'goblin_0',
            walkAnim: 'goblin_walk',
            hp: 12,
            speed: 95,
            contactDamage: 6,
            gemTier: 0,
            shadowKey: 'shadow_small',
            bodyW: 8,
            bodyH: 8,
            bodyOffsetY: 2
        });
    }
}
