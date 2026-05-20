/*
 * Aura unlock - persistent ring around the player. The texture and tint come
 * from each character's aura template (Velorian's Sanctity Aura, Pyra's
 * Inferno Trail, Lyra's Curse Nimbus, Borg's Frost Nova). Mechanics are
 * shared: every `tickMs` we damage every enemy inside `radius`.
 */
export class HolyAura {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this.runState = scene.runState;
        this.lastTickAt = 0;

        const tex = this.runState.aura.texture || 'holy_aura';
        this.sprite = scene.add.image(player.x, player.y, tex);
        this.sprite.setOrigin(0.5, 0.5);
        this.sprite.setBlendMode(Phaser.BlendModes.ADD);
        if (this.runState.aura.tint !== undefined) this.sprite.setTint(this.runState.aura.tint);
        this.sprite.setVisible(false);
    }

    update(time) {
        const def = this.runState.aura;
        if (!def.active) {
            this.sprite.setVisible(false);
            return;
        }
        if (this.runState.gameOver) return;

        this.sprite.setVisible(true);
        this.sprite.setPosition(this.player.x, this.player.y - 4);
        const scale = (def.radius * 2) / 100;
        this.sprite.setScale(scale);
        this.sprite.setAlpha(0.32 + 0.08 * Math.sin(time * 0.005));
        this.sprite.setDepth(this.player.y - 1);

        if (time - this.lastTickAt >= def.tickMs) {
            this.lastTickAt = time;
            const r2 = def.radius * def.radius;
            const enemies = this.scene.enemies.getChildren().slice();
            for (const enemy of enemies) {
                if (!enemy.active) continue;
                const dx = enemy.x - this.player.x;
                const dy = (enemy.y - 4) - this.player.y;
                if (dx * dx + dy * dy <= r2) {
                    enemy.takeDamage(def.damage, this.player);
                    this.scene.runState.damageByWeapon.aura += def.damage;
                    // Aura DoT pulses are gentler statuses
                    this.scene.applyHitStatuses?.(enemy, 0.5);
                }
            }
        }
    }
}
