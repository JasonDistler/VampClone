/*
 * Flameburst - Pyra's signature weapon. Every cooldown, fires a radial spread
 * of fire bolts in all directions from the player. Bolts are physics sprites
 * dropped into the scene's player-projectile group (`daggers`) so they share
 * the existing dagger-vs-enemy overlap and obstacle-collider setup.
 */
export class Flameburst {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this.runState = scene.runState;
        this.nextBurstAt = 0;
    }

    update(time) {
        if (this.runState.gameOver) return;
        const def = this.runState.weapon;
        if (time >= this.nextBurstAt) {
            this.fire(time);
            this.nextBurstAt = time + def.cooldownMs;
        }
    }

    fire(time) {
        const def = this.runState.weapon;
        const count = Math.max(3, def.count || 6);
        const baseAngle = (time * 0.0006) % (Math.PI * 2);
        for (let i = 0; i < count; i++) {
            const angle = baseAngle + (i / count) * Math.PI * 2;
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);
            this.spawnBolt(dx, dy);
        }
    }

    spawnBolt(dx, dy) {
        const def = this.runState.weapon;
        const sprite = this.scene.physics.add.sprite(this.player.x, this.player.y - 4, def.projectileTexture || 'fire_bolt');
        sprite.damage = def.damage;
        sprite.pierce = def.pierce || 2;
        sprite.hitSet = new Set();
        sprite.setOrigin(0.5, 0.5);
        sprite.setBlendMode(Phaser.BlendModes.ADD);
        sprite.setRotation(Math.atan2(dy, dx));
        sprite.setVelocity(dx * (def.speed || 200), dy * (def.speed || 200));
        sprite.setDepth(this.player.y);
        sprite.spawnedAt = this.scene.time.now;
        sprite.lifetimeMs = def.lifetimeMs || 700;
        if (def.explosion) {
            sprite.explosionDamage = def.damage * (def.explosion.damageMult || 2);
            sprite.explosionRadius = def.explosion.radius || 24;
            sprite.explosionTint = def.explosion.tint || 0xffffff;
            sprite.explosionTexture = def.explosion.texture || 'holy_aura';
        }
        this.scene.daggers.add(sprite);
    }
}
