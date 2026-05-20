import { Enemy } from '../Enemy.js';

export class Wraith extends Enemy {
    constructor(scene, x, y) {
        super(scene, x, y, {
            id: 'wraith',
            texture: 'wraith_0',
            walkAnim: 'wraith_float',
            hp: 30,
            speed: 75,
            contactDamage: 10,
            gemTier: 1,
            shadowKey: 'shadow_small',
            knockbackResist: 0.5,
            ignoreSeparation: true,
            bodyW: 10,
            bodyH: 14,
            bodyOffsetY: 2
        });
        this.setAlpha(0.78);
        if (this.shadow) this.shadow.setAlpha(0.25);
        this.flickerPhase = Math.random() * Math.PI * 2;
    }

    subUpdate(time) {
        const flicker = 0.65 + 0.18 * Math.sin(time * 0.006 + this.flickerPhase);
        this.setAlpha(flicker);
    }
}
