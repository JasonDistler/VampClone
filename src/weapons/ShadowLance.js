/*
 * Shadow Lance - Lyra's auto-targeting bolt. Each cooldown we find the
 * nearest active enemy and fire a piercing magic bolt straight at them.
 * Pure straight-line projectile (no homing) - the targeting itself does
 * most of the work and rewards moving toward enemies for tighter clusters.
 */
export class ShadowLance {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this.runState = scene.runState;
        this.nextShotAt = 0;
    }

    update(time) {
        if (this.runState.gameOver) return;
        const def = this.runState.weapon;
        if (time < this.nextShotAt) return;

        const target = this.findNearestEnemy();
        if (!target) return;

        this.nextShotAt = time + def.cooldownMs;
        const dx = target.x - this.player.x;
        const dy = (target.y - 4) - this.player.y;
        const len = Math.hypot(dx, dy) || 1;
        this.spawnBolt(dx / len, dy / len);
    }

    findNearestEnemy() {
        const enemies = this.scene.enemies.getChildren();
        let best = null;
        let bestD2 = Infinity;
        const maxRange = 360;
        const maxR2 = maxRange * maxRange;
        for (const e of enemies) {
            if (!e.active) continue;
            const dx = e.x - this.player.x;
            const dy = e.y - this.player.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestD2 && d2 < maxR2) { best = e; bestD2 = d2; }
        }
        return best;
    }

    spawnBolt(dx, dy) {
        const def = this.runState.weapon;
        const sprite = this.scene.physics.add.sprite(this.player.x, this.player.y - 4, def.projectileTexture || 'magic_bolt');
        sprite.damage = def.damage;
        sprite.pierce = def.pierce || 2;
        sprite.hitSet = new Set();
        sprite.setOrigin(0.5, 0.5);
        sprite.setBlendMode(Phaser.BlendModes.ADD);
        sprite.setRotation(Math.atan2(dy, dx));
        sprite.setVelocity(dx * (def.speed || 320), dy * (def.speed || 320));
        sprite.setDepth(this.player.y);
        sprite.spawnedAt = this.scene.time.now;
        sprite.lifetimeMs = def.lifetimeMs || 900;
        if (def.explosion) {
            sprite.explosionDamage = def.damage * (def.explosion.damageMult || 2);
            sprite.explosionRadius = def.explosion.radius || 24;
            sprite.explosionTint = def.explosion.tint || 0xffffff;
            sprite.explosionTexture = def.explosion.texture || 'holy_aura';
        }
        this.scene.daggers.add(sprite);
    }
}
