import { Enemy } from '../Enemy.js';

export class Bat extends Enemy {
    constructor(scene, x, y) {
        super(scene, x, y, {
            id: 'bat',
            texture: 'bat_0',
            walkAnim: 'bat_flap',
            hp: 8,
            speed: 130,
            contactDamage: 5,
            gemTier: 0,
            shadowKey: 'shadow_small',
            bodyW: 8,
            bodyH: 6,
            bodyOffsetY: 2
        });
        if (this.shadow) this.shadow.setAlpha(0.3);
        this.bobPhase = Math.random() * Math.PI * 2;
    }

    subUpdate(time) {
        this.y += Math.sin((time + this.bobPhase * 1000) * 0.012) * 0.4;
    }
}
