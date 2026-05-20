import { xpForLevel } from './RunState.js';
import { audio } from './AudioSystem.js';

const GEM_KEYS = ['gem_blue', 'gem_green', 'gem_gold'];
/* Per-tier XP value of a gem. Original baseline values - intentionally
 * not inflated; XP gain is gated by the drop rate below instead. */
const GEM_VALUES = [1, 3, 5];

/* Fraction of kills that drop a gem at all. Halved from the previous
 * 0.9 - leveling up should feel earned, especially deep into a run. */
const GEM_DROP_CHANCE = 0.45;

export class XpSystem {
    constructor(scene) {
        this.scene = scene;
        this.gems = scene.physics.add.group();
    }

    dropGem(x, y, tier) {
        if (Math.random() > GEM_DROP_CHANCE) return;
        const tierIndex = Math.min(2, Math.max(0, tier));
        const sprite = this.scene.physics.add.sprite(x, y, GEM_KEYS[tierIndex]);
        sprite.setOrigin(0.5, 0.95);
        sprite.value = GEM_VALUES[tierIndex];
        sprite.setDepth(y - 0.25);
        sprite.setSize(8, 8);
        this.gems.add(sprite);
    }

    update(time, dt) {
        if (this.scene.runState.gameOver) return;
        const player = this.scene.player;
        if (!player || !player.active) return;
        const magnet = this.scene.runState.magnet;
        const gems = this.gems.getChildren();
        for (const gem of gems) {
            const dx = player.x - gem.x;
            const dy = player.y - gem.y;
            const d = Math.hypot(dx, dy);
            if (d < magnet) {
                const speed = 220 + (magnet - d) * 4;
                gem.setVelocity((dx / d) * speed, (dy / d) * speed);
            }
            if (d < 10) {
                this.collect(gem);
            }
        }
    }

    collect(gem) {
        const value = gem.value || 1;
        const rs = this.scene.runState;
        rs.xp += value;
        // Particles tinted to the gem color so a gold gem pops gold
        // confetti, blue pops cyan, etc.
        const TIER_COLOR = [0x9bd6ff, 0xa8f070, 0xfff4a8];
        const color = TIER_COLOR[Math.min(2, Math.max(0, value === 1 ? 0 : value === 3 ? 1 : 2))];
        this.scene.particles?.spawnGemPop(gem.x, gem.y - 2, color);
        gem.destroy();
        audio.gemPickup();
        while (rs.xp >= rs.xpToNext) {
            rs.xp -= rs.xpToNext;
            rs.level += 1;
            rs.xpToNext = xpForLevel(rs.level);
            this.scene.triggerLevelUp();
        }
    }
}
