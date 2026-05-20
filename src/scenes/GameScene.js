import { GAME_WIDTH, GAME_HEIGHT } from '../main.js';
import { Player } from '../entities/Player.js';
import { Greatsword } from '../weapons/Greatsword.js';
import { HolyAura } from '../weapons/HolyAura.js';
import { Daggers } from '../weapons/Daggers.js';
import { Flameburst } from '../weapons/Flameburst.js';
import { ShadowLance } from '../weapons/ShadowLance.js';
import { IceHammer } from '../weapons/IceHammer.js';
import { SpawnDirector, ENEMY_DAMAGE_MULT } from '../systems/SpawnDirector.js';
import { XpSystem } from '../systems/XpSystem.js';
import { HeartSystem } from '../systems/HeartSystem.js';
import { DamageNumbers } from '../systems/DamageNumbers.js';
import { createRunState, REGISTRY_KEY, difficultyMultiplier } from '../systems/RunState.js';
import { pickEnvironment, scatterObstacles } from '../systems/Environment.js';
import { getCharacter, REGISTRY_CHARACTER_KEY, REGISTRY_DIFFICULTY_KEY } from '../characters/Characters.js';
import { hudOverlay } from '../ui/HudOverlay.js';
import { gamepad } from '../systems/Gamepad.js';
import { audio } from '../systems/AudioSystem.js';
import { ParticleSystem } from '../systems/Particles.js';
import { updateStatusEffects, applyBurn, applyFreeze, applyPoison, applyShock } from '../systems/StatusEffects.js';
import { metaProgress } from '../systems/MetaProgress.js';
import { applyCurses } from '../systems/Curses.js';
import { seededRandom } from '../systems/Seed.js';

const PRIMARY_WEAPONS = {
    greatsword: Greatsword,
    flameburst: Flameburst,
    shadowlance: ShadowLance,
    icehammer: IceHammer
};

const WORLD_HALF = 8000;

/*
 * Default camera zoom for gameplay. < 1 = wider visible playfield.
 * Used as the "rest" zoom level - juicy effects (level-up, boss
 * intro, hit-stop kicker) zoom slightly above this and ease back.
 */
export const GAME_CAMERA_ZOOM = 0.8;

export class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    create() {
        const characterId = this.registry.get(REGISTRY_CHARACTER_KEY) || 'velorian';
        const difficulty = this.registry.get(REGISTRY_DIFFICULTY_KEY) || 'normal';
        this.character = getCharacter(characterId);
        this.difficulty = difficulty;
        this.difficultyMult = difficultyMultiplier(difficulty);

        // Pre-run flags pushed onto the registry by the title screen
        const dailySeed = this.registry.get('dailySeed');     // number | null
        const activeCurses = this.registry.get('activeCurses') || []; // string[]

        this.runState = createRunState(this.character, difficulty);

        // Apply meta-progression unlocks (HP / damage / armor / magnet
        // tier passives) before curses so curses see the buffed stats.
        metaProgress.applyToRunState(this.runState);

        // Apply curses - mutates rs.cursed* fields and scoreMult.
        if (activeCurses.length) {
            applyCurses(this.runState, activeCurses);
        }

        // If a daily seed was set, make Math.random deterministic for
        // this run so spawns + drops + crit rolls are reproducible.
        if (dailySeed) {
            this.runState.seed = dailySeed;
            seededRandom.seed(dailySeed);
            this._seedDispose = seededRandom.install();
        }

        this.registry.set(REGISTRY_KEY, this.runState);
        this.levelUpInProgress = false;
        this.pendingLevelUps = 0;

        this.physics.world.setBounds(-WORLD_HALF, -WORLD_HALF, WORLD_HALF * 2, WORLD_HALF * 2);

        this.environment = pickEnvironment();
        this.environmentName = this.environment.name;

        this.bgTile = this.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH + 64, GAME_HEIGHT + 64, this.environment.bgTexture);
        this.bgTile.setOrigin(0.5, 0.5);
        this.bgTile.setDepth(-10000);
        this.bgTile.setScrollFactor(0);

        this.ambientOverlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, this.environment.ambientTint, this.environment.ambientTintStrength);
        this.ambientOverlay.setOrigin(0.5);
        this.ambientOverlay.setScrollFactor(0);
        this.ambientOverlay.setDepth(-9999);
        this.ambientOverlay.setBlendMode(Phaser.BlendModes.MULTIPLY);

        this.enemies = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite });
        this.enemyProjectiles = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite });
        this.daggers = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite });
        this.obstacles = this.physics.add.staticGroup();

        this.populateEnvironment();

        this.player = new Player(this, 0, 0, this.character);

        /*
         * Zoom < 1 renders the world smaller, so the player sees a wider
         * area of the playfield. 0.8 gives ~25% more visible area in
         * each axis while keeping the new 4-frame character sprites
         * readable at their detail level. setRoundPixels keeps pixel-art
         * sharp by snapping the camera to integer world coordinates.
         */
        this.cameras.main.startFollow(this.player, true, 0.18, 0.18);
        this.cameras.main.setRoundPixels(true);
        this.cameras.main.setZoom(GAME_CAMERA_ZOOM);

        const PrimaryClass = PRIMARY_WEAPONS[this.character.startingWeapon] || Greatsword;
        this.primaryWeapon = new PrimaryClass(this, this.player);
        this.holyAura = new HolyAura(this, this.player);
        this.daggersWeapon = new Daggers(this, this.player);
        this.spawnDirector = new SpawnDirector(this);
        this.xpSystem = new XpSystem(this);
        this.damageNumbers = new DamageNumbers(this);
        this.heartSystem = new HeartSystem(this);
        this.particles = new ParticleSystem(this);
        this.chests = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite });
        this.physics.add.overlap(this.player, this.chests, (p, chest) => {
            if (!chest.active || chest._opening) return;
            this._openChest(chest);
        });

        // Per-biome ambient weather. forest=clear, swamp=rain,
        // library/cathedral=embers (candle smoke), ice_cavern=snow,
        // volcano=embers (lots of them).
        const WEATHER_BY_BIOME = {
            forest: null,
            swamp: 'rain',
            library: 'embers',
            cathedral: 'embers',
            ice_cavern: 'snow',
            volcano: 'embers'
        };
        this.particles.setWeather(WEATHER_BY_BIOME[this.environment.key] ?? null);

        this.physics.add.overlap(this.player, this.enemies, (p, e) => {
            if (!e.active) return;
            const took = p.takeDamage(e.contactDamage, this.time.now);
            if (took) {
                const dx = e.x - p.x;
                const dy = e.y - p.y;
                const d = Math.hypot(dx, dy) || 1;
                e.knockbackVx += (dx / d) * 80 * (1 - e.knockbackResist);
                e.knockbackVy += (dy / d) * 80 * (1 - e.knockbackResist);
            }
        });
        this.physics.add.overlap(this.player, this.enemyProjectiles, (p, proj) => {
            if (!proj.active) return;
            const took = p.takeDamage(proj.damage || 6, this.time.now);
            if (took) proj.destroy();
        });
        this.physics.add.overlap(this.daggers, this.enemies, (dagger, enemy) => {
            if (!dagger.active || !enemy.active) return;
            if (!dagger.hitSet) dagger.hitSet = new Set();
            if (dagger.hitSet.has(enemy)) return;
            dagger.hitSet.add(enemy);
            const dmg = dagger.damage || 18;
            enemy.takeDamage(dmg, dagger);
            this.runState.damageByWeapon.daggers += dmg;
            this.applyHitStatuses(enemy);
            if (dagger.hitSet.size >= (dagger.pierce || 1)) {
                this.destroyPlayerProjectile(dagger);
            }
        });

        this.physics.add.collider(this.player, this.obstacles);
        this.physics.add.collider(this.enemies, this.obstacles);
        this.physics.add.collider(this.enemyProjectiles, this.obstacles, (proj) => proj.destroy());
        this.physics.add.collider(this.daggers, this.obstacles, (dagger) => this.destroyPlayerProjectile(dagger));

        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });

        /*
         * Tab key opens an in-run stats panel (left side of screen)
         * showing weapon stats, current upgrades, and base stats.
         * Released = panel closes, so it's a quick "press to peek" rather
         * than a toggle. Capturing keydown/keyup directly because Phaser
         * defaults to letting Tab pass through for browser focus.
         */
        const tabKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
        tabKey.on('down', () => hudOverlay.showStatsPanel(this.runState, this.character));
        tabKey.on('up',   () => hudOverlay.hideStatsPanel());
        // Prevent the browser from stealing Tab focus from the canvas
        this.input.keyboard.addCapture('TAB');

        this.playIntroFlair();

        /*
         * Biome-flavored procedural music. The audio system already
         * handles autoplay-policy gating - if the user hasn't clicked
         * yet (rare here, since they had to click "Start Run") this
         * is a no-op until the context unlocks.
         */
        audio.playMusic(this.environment.key);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            audio.stopMusic();
            hudOverlay.hideBossBanner();
            hudOverlay.hideBossHp();
            hudOverlay.hideLowHpVignette();
            hudOverlay.hideStatsPanel();
            // Restore Math.random when a seeded daily run ends
            if (this._seedDispose) { this._seedDispose(); this._seedDispose = null; }
        });
    }

    /*
     * Run-start flair: a quick camera flash tinted to the character's
     * accent color, plus the HD HTML callout that names the hero and
     * their starting weapon. Fades out on its own after ~2.5s.
     */
    playIntroFlair() {
        const accentHex = this.character.accent || '#f5c54b';
        const c = Phaser.Display.Color.HexStringToColor(accentHex);
        this.cameras.main.flash(700, c.red, c.green, c.blue);
        hudOverlay.showIntroCallout(this.character);
    }

    /*
     * Visual + AOE detonation. Used by Pyra's Flameburst and Lyra's
     * Shadow Lance: when one of their bolts dies (pierces out, hits an
     * obstacle, or expires) we trigger a small expanding ring at its
     * last position, dealing flat damage to every enemy inside `radius`.
     */
    spawnExplosion(x, y, radius, damage, tint) {
        const tex = 'holy_aura';
        const ring = this.add.image(x, y, tex);
        ring.setOrigin(0.5, 0.5);
        ring.setBlendMode(Phaser.BlendModes.ADD);
        if (tint !== undefined) ring.setTint(tint);
        // holy_aura art is ~100px diameter, scale to match desired radius
        const finalScale = (radius * 2) / 100;
        ring.setScale(finalScale * 0.2);
        ring.setAlpha(0.95);
        ring.setDepth(y + 2);
        this.tweens.add({
            targets: ring,
            scale: finalScale,
            alpha: 0,
            duration: 240,
            ease: 'Cubic.easeOut',
            onComplete: () => ring.destroy()
        });

        const r2 = radius * radius;
        const enemies = this.enemies.getChildren().slice();
        for (const e of enemies) {
            if (!e.active) continue;
            const dx = e.x - x;
            const dy = e.y - y;
            if (dx * dx + dy * dy <= r2) {
                e.takeDamage(damage, this.player);
                // AOE applies status with reduced intensity so a
                // huge ult doesn't permanently freeze a screen.
                this.applyHitStatuses(e, 0.6);
            }
        }
    }

    /*
     * Single shared death path for player projectiles in the daggers
     * group. Wraps the explosion check so the three places that destroy
     * projectiles (enemy hit-out, obstacle collide, lifetime expiry) all
     * detonate consistently if the projectile carries explosion props.
     */
    destroyPlayerProjectile(proj) {
        if (proj && proj.active && proj.explosionDamage) {
            this.spawnExplosion(
                proj.x,
                proj.y,
                proj.explosionRadius,
                proj.explosionDamage,
                proj.explosionTint
            );
        }
        if (proj) proj.destroy();
    }

    populateEnvironment() {
        const records = scatterObstacles(this, this.environment, 4000);
        for (const rec of records) {
            const ob = this.obstacles.create(rec.x, rec.y, rec.texture);
            ob.setOrigin(0.5, 1);
            ob.body.setSize(rec.bodyW, rec.bodyH, false);
            const offsetX = (rec.width - rec.bodyW) / 2;
            const offsetY = rec.baseY - rec.bodyH;
            ob.body.setOffset(offsetX, offsetY);
            ob.refreshBody();
            ob.setDepth(rec.y);
        }
    }

    spawnEnemyProjectile(x, y, dx, dy, opts) {
        const sprite = this.physics.add.sprite(x, y, opts.texture || 'bone');
        // Same global enemy-damage bump that contact damage gets in
        // SpawnDirector. Keeps melee + ranged enemies in lockstep.
        sprite.damage = Math.round((opts.damage || 6) * ENEMY_DAMAGE_MULT);
        sprite.setOrigin(0.5, 0.5);
        sprite.setDepth(y);
        const speed = opts.speed || 130;
        sprite.setVelocity(dx * speed, dy * speed);
        sprite.lifetimeMs = opts.lifetimeMs || 2400;
        sprite.spawnedAt = this.time.now;
        if (opts.alignToVelocity) {
            sprite.setRotation(Math.atan2(dy, dx));
            sprite.angularVel = 0;
        } else {
            sprite.angularVel = opts.spinDeg !== undefined ? opts.spinDeg : (Math.random() < 0.5 ? 1 : -1) * 360;
        }
        this.enemyProjectiles.add(sprite);
        return sprite;
    }

    triggerLevelUp() {
        if (this.runState.gameOver) return;
        if (this.levelUpInProgress) {
            this.pendingLevelUps = (this.pendingLevelUps || 0) + 1;
            return;
        }
        // Burst right at the player's feet so the level-up moment has a
        // visceral payoff before the modal opens.
        this.particles?.spawnLevelUpBurst(this.player.x, this.player.y - 6);
        this.levelUpInProgress = true;
        this.scene.pause();
        this.scene.launch('LevelUpScene', { runState: this.runState });
    }

    /*
     * Hit-stop. Briefly freezes the physics + animation timestep so
     * heavy hits feel meaty.
     *
     * Implemented by setting a hitStopUntilWall flag (real wall-clock
     * timestamp). The main update() loop skips physics + enemy +
     * weapon updates while frozen but still draws particles and
     * damage numbers so the hit feels like a snapshot in time. Wall-
     * clock timing means the freeze duration is independent of
     * game-time scaling and works even at variable framerates.
     */
    applyHitStop(durationMs = 65) {
        const wallNow = performance.now();
        const newUntil = wallNow + durationMs;
        if (newUntil > (this._hitStopUntilWall || 0)) {
            this._hitStopUntilWall = newUntil;
        }
    }

    isHitStopped() {
        return performance.now() < (this._hitStopUntilWall || 0);
    }

    /*
     * Apply the running character's signature status effect to a hit
     * enemy. Read from `this.character.onHitStatus` so each character
     * has thematic flavor:
     *   Pyra (fire)   -> burn
     *   Borg (ice)    -> freeze
     *   Lyra (shadow) -> shock (chains via shock effect tick)
     *   Velorian      -> none baseline (paladin), but his evolved
     *                    weapon adds smite/holy DoT which is modeled
     *                    as a brief burn with golden tint
     *
     * Chance gate so even at 100% it can be tuned by gear, and each
     * effect carries its own duration/dps. Returns true if applied.
     */
    _registerChest(chest) {
        if (this.chests) this.chests.add(chest);
    }

    /*
     * Treasure chest open. The chest pops, drops a bonus heart + gem,
     * and triggers an extra level-up style upgrade pick. We use the
     * existing LevelUpScene since it already implements card UI and
     * upgrade resolution - just route the result back into runState.
     */
    _openChest(chest) {
        chest._opening = true;
        chest.disableBody?.(true, false);
        this.particles?.spawnChestOpen(chest.x, chest.y - 4);
        this.tweens.add({
            targets: chest,
            scale: 1.6,
            alpha: 0,
            duration: 280,
            ease: 'Back.easeOut',
            onComplete: () => chest.destroy()
        });
        if (this.activeChest === chest) this.activeChest = null;
        this.runState.chestsOpened = (this.runState.chestsOpened || 0) + 1;
        this._notifyAchievement('chestSeeker', this.runState.chestsOpened >= 3);
        // Bonus rewards regardless of upgrade pick - heart + 2 gold gems
        this.spawnDirector._dropHeart?.(chest.x + 6, chest.y);
        this.spawnDirector._forceDropGem?.(chest.x - 6, chest.y, 2);
        this.spawnDirector._forceDropGem?.(chest.x + 6, chest.y, 2);
        // Trigger an extra upgrade pick. We reuse triggerLevelUp's
        // machinery - it pauses, launches LevelUpScene with the run
        // state, and applies the chosen upgrade. The level counter
        // doesn't go up because we're not awarding XP, just an extra
        // pick.
        this.triggerLevelUp();
    }

    applyHitStatuses(enemy, intensity = 1) {
        if (!enemy || !enemy.active) return false;
        const onHit = this.character?.onHitStatus;
        if (!onHit) return false;
        if (Math.random() > (onHit.chance ?? 1) * intensity) return false;
        switch (onHit.type) {
            case 'burn':   applyBurn(enemy, onHit.durationMs ?? 1500, (onHit.dps ?? 12) * intensity); break;
            case 'freeze': applyFreeze(enemy, onHit.durationMs ?? 900, onHit.slowFactor ?? 0.4); break;
            case 'poison': applyPoison(enemy, onHit.durationMs ?? 2400, (onHit.dps ?? 8) * intensity); break;
            case 'shock':  applyShock(enemy, onHit.durationMs ?? 600, onHit.jumps ?? 2); break;
            default: return false;
        }
        return true;
    }

    handleLevelUpResolved() {
        this.levelUpInProgress = false;
        if (this.pendingLevelUps && this.pendingLevelUps > 0) {
            this.pendingLevelUps -= 1;
            this.triggerLevelUp();
        }
    }

    handlePlayerDeath() {
        this.runState.gameOver = true;
        // Cash out run gold + persist best stats
        const survivalSec = Math.floor(this.runState.elapsedMs / 1000);
        const earnedGold = metaProgress.finishRun({
            kills: this.runState.kills,
            survivalSec,
            runGold: this.runState.runGold || 0
        });
        this.runState.metaGoldEarned = earnedGold;
        // Daily best
        if (this.runState.seed) {
            const score = this.runState.kills * 10 + survivalSec * 5;
            metaProgress.recordDaily(this.runState.seed, score);
        }
        // Survival achievements
        this._notifyAchievement?.('survive5', survivalSec >= 5 * 60);
        this._notifyAchievement?.('survive15', survivalSec >= 15 * 60);
        this._notifyAchievement?.('flawless5', this.runState.flawless && survivalSec >= 5 * 60);

        this.scene.pause();
        this.scene.launch('GameOverScene', { runState: this.runState });
    }

    /*
     * Central achievement awarder. Called by enemies, boss handler,
     * level-up, etc. The metaProgress instance ensures each achievement
     * fires only once across all runs.
     */
    _notifyAchievement(id, condition = true) {
        if (!condition) return;
        if (metaProgress.award(id)) {
            const def = metaProgress.achievementDefs().find(a => a.id === id);
            if (def) hudOverlay.showAchievement(def.name, def.icon);
            audio.levelUp();
        }
    }

    update(time, dt) {
        if (this.runState.gameOver) {
            // Keep flushing in-flight damage numbers so they fade out cleanly
            // instead of freezing mid-air on the death frame.
            this.damageNumbers?.update(time);
            this.particles?.update(time, dt);
            return;
        }

        // Hit-stop: freeze gameplay logic but keep drawing particles and
        // damage numbers so the hit reads as a frozen impact frame.
        if (this.isHitStopped()) {
            this.particles?.update(time, dt);
            this.damageNumbers?.update(time);
            return;
        }

        this.runState.elapsedMs += dt;

        const gp = gamepad.movement();
        const input = {
            /* Combine keyboard with gamepad - left stick + d-pad already
             * unified inside gamepad.movement() so we just OR the two
             * input sources. Either device works on its own. */
            left: this.cursors.left.isDown || this.wasd.left.isDown || gp.left,
            right: this.cursors.right.isDown || this.wasd.right.isDown || gp.right,
            up: this.cursors.up.isDown || this.wasd.up.isDown || gp.up,
            down: this.cursors.down.isDown || this.wasd.down.isDown || gp.down
        };

        this.player.update(time, dt, input);
        const cam = this.cameras.main;
        this.bgTile.setTilePosition(cam.scrollX, cam.scrollY);

        const enemies = this.enemies.getChildren().slice();
        for (const e of enemies) e.update(time, dt);

        const projectiles = this.enemyProjectiles.getChildren().slice();
        for (const proj of projectiles) {
            proj.rotation += (proj.angularVel * Math.PI / 180) * (dt / 1000);
            proj.setDepth(proj.y);
            if (time - proj.spawnedAt > proj.lifetimeMs) proj.destroy();
        }

        const daggers = this.daggers.getChildren().slice();
        for (const dagger of daggers) {
            dagger.setDepth(dagger.y);
            if (time - dagger.spawnedAt > dagger.lifetimeMs) this.destroyPlayerProjectile(dagger);
        }

        this.primaryWeapon.update(time);
        this.holyAura?.update(time);
        this.daggersWeapon?.update(time);
        this.spawnDirector.update(time, dt);
        this.xpSystem.update(time, dt);
        this.heartSystem.update(time);
        this.damageNumbers.update(time);
        this.particles.update(time, dt);
        updateStatusEffects(this, time, dt);

        // Drive the low-HP vignette every frame from current HP frac.
        // HudOverlay handles tier debouncing internally so this is cheap.
        if (this.runState.maxHp > 0) {
            hudOverlay.updateLowHpVignette(this.runState.hp / this.runState.maxHp);
        }
    }
}
