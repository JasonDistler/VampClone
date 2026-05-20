import {
    paintVelorianDown,
    paintVelorianUp,
    paintVelorianSide,
    paintGoblin,
    paintSkeleton,
    paintOrcBrute,
    paintBat,
    paintZombie,
    paintWraith,
    paintBeholder,
    paintGoblinSniper,
    paintGoblinBerserker,
    paintFireElemental,
    paintNecrotech,
    paintShadowmancer,
    paintDeathKnight,
    paintFrostGiant,
    paintBalor,
    paintGemBlue,
    paintGemGreen,
    paintGemGold,
    paintHeart,
    paintTreasureChest,
    paintBoneProjectile,
    paintMagicBolt,
    paintDagger,
    paintArrow,
    paintFireBolt,
    paintIceShard,
    paintHellfireOrb,
    paintSwordArc,
    paintHolyAura,
    paintShadow,
    paintCobblestone,
    paintGrass,
    paintSwampMud,
    paintWoodFloor,
    paintTree,
    paintDeadTree,
    paintRock,
    paintBookshelf,
    paintCandelabra,
    paintCrate,
    paintDesk
} from '../art/PixelArt.js';
import { graphicsMode } from '../systems/GraphicsMode.js';

export class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    create() {
        const register = (key, canvas) => {
            this.textures.addCanvas(key, canvas);
        };

        /* Velorian + the playable enemy-sprite-based heroes (Pyra, Lyra,
         * Borg) all use 4-frame walk/float cycles. Frames 0 and 2 are
         * "contact" poses; 1 and 3 are "passing" poses. Frame 0 is
         * always the static portrait/initial frame. */
        register('velorian_down_0', paintVelorianDown(0));
        register('velorian_down_1', paintVelorianDown(1));
        register('velorian_down_2', paintVelorianDown(2));
        register('velorian_down_3', paintVelorianDown(3));
        register('velorian_up_0', paintVelorianUp(0));
        register('velorian_up_1', paintVelorianUp(1));
        register('velorian_up_2', paintVelorianUp(2));
        register('velorian_up_3', paintVelorianUp(3));
        register('velorian_side_0', paintVelorianSide(0));
        register('velorian_side_1', paintVelorianSide(1));
        register('velorian_side_2', paintVelorianSide(2));
        register('velorian_side_3', paintVelorianSide(3));

        register('goblin_0', paintGoblin(0));
        register('goblin_1', paintGoblin(1));
        register('skeleton_0', paintSkeleton(0));
        register('skeleton_1', paintSkeleton(1));
        register('orc_0', paintOrcBrute(0));
        register('orc_1', paintOrcBrute(1));
        register('bat_0', paintBat(0));
        register('bat_1', paintBat(1));
        register('zombie_0', paintZombie(0));
        register('zombie_1', paintZombie(1));
        register('wraith_0', paintWraith(0));
        register('wraith_1', paintWraith(1));
        register('beholder_0', paintBeholder(0));
        register('beholder_1', paintBeholder(1));
        register('goblin_sniper_0', paintGoblinSniper(0));
        register('goblin_sniper_1', paintGoblinSniper(1));
        register('goblin_berserker_0', paintGoblinBerserker(0));
        register('goblin_berserker_1', paintGoblinBerserker(1));
        register('fire_elemental_0', paintFireElemental(0));
        register('fire_elemental_1', paintFireElemental(1));
        register('fire_elemental_2', paintFireElemental(2));
        register('fire_elemental_3', paintFireElemental(3));
        register('necrotech_0', paintNecrotech(0));
        register('necrotech_1', paintNecrotech(1));
        register('shadowmancer_0', paintShadowmancer(0));
        register('shadowmancer_1', paintShadowmancer(1));
        register('shadowmancer_2', paintShadowmancer(2));
        register('shadowmancer_3', paintShadowmancer(3));
        register('death_knight_0', paintDeathKnight(0));
        register('death_knight_1', paintDeathKnight(1));
        register('frost_giant_0', paintFrostGiant(0));
        register('frost_giant_1', paintFrostGiant(1));
        register('frost_giant_2', paintFrostGiant(2));
        register('frost_giant_3', paintFrostGiant(3));
        register('balor_0', paintBalor(0));
        register('balor_1', paintBalor(1));

        register('gem_blue', paintGemBlue());
        register('gem_green', paintGemGreen());
        register('gem_gold', paintGemGold());
        register('heart', paintHeart());
        register('treasure_chest', paintTreasureChest());

        register('bone', paintBoneProjectile());
        register('magic_bolt', paintMagicBolt());
        register('dagger', paintDagger());
        register('arrow', paintArrow());
        register('fire_bolt', paintFireBolt());
        register('ice_shard', paintIceShard());
        register('hellfire', paintHellfireOrb());
        register('sword_arc', paintSwordArc());
        register('holy_aura', paintHolyAura());

        register('shadow_small', paintShadow(14));
        register('shadow_med', paintShadow(20));
        register('shadow_large', paintShadow(28));

        register('cobble', paintCobblestone());
        register('grass', paintGrass());
        register('swamp_mud', paintSwampMud());
        register('wood_floor', paintWoodFloor());

        register('tree', paintTree());
        register('dead_tree', paintDeadTree());
        register('rock', paintRock());
        register('bookshelf', paintBookshelf());
        register('candelabra', paintCandelabra());
        register('crate', paintCrate());
        register('desk', paintDesk());

        /*
         * 4-frame walk cycles. Frame rate is bumped from the old 2-frame
         * value so the same-length frames-per-second drives the same
         * cycles-per-second (one full step pair every ~0.6s).
         */
        this.anims.create({
            key: 'velorian_down_walk',
            frames: [
                { key: 'velorian_down_0' }, { key: 'velorian_down_1' },
                { key: 'velorian_down_2' }, { key: 'velorian_down_3' }
            ],
            frameRate: 8,
            repeat: -1
        });
        this.anims.create({
            key: 'velorian_up_walk',
            frames: [
                { key: 'velorian_up_0' }, { key: 'velorian_up_1' },
                { key: 'velorian_up_2' }, { key: 'velorian_up_3' }
            ],
            frameRate: 8,
            repeat: -1
        });
        this.anims.create({
            key: 'velorian_side_walk',
            frames: [
                { key: 'velorian_side_0' }, { key: 'velorian_side_1' },
                { key: 'velorian_side_2' }, { key: 'velorian_side_3' }
            ],
            frameRate: 8,
            repeat: -1
        });

        this.anims.create({
            key: 'goblin_walk',
            frames: [{ key: 'goblin_0' }, { key: 'goblin_1' }],
            frameRate: 5,
            repeat: -1
        });
        this.anims.create({
            key: 'skeleton_walk',
            frames: [{ key: 'skeleton_0' }, { key: 'skeleton_1' }],
            frameRate: 4,
            repeat: -1
        });
        this.anims.create({
            key: 'orc_walk',
            frames: [{ key: 'orc_0' }, { key: 'orc_1' }],
            frameRate: 3,
            repeat: -1
        });
        this.anims.create({
            key: 'bat_flap',
            frames: [{ key: 'bat_0' }, { key: 'bat_1' }],
            frameRate: 12,
            repeat: -1
        });
        this.anims.create({
            key: 'zombie_walk',
            frames: [{ key: 'zombie_0' }, { key: 'zombie_1' }],
            frameRate: 3,
            repeat: -1
        });
        this.anims.create({
            key: 'wraith_float',
            frames: [{ key: 'wraith_0' }, { key: 'wraith_1' }],
            frameRate: 3,
            repeat: -1
        });
        this.anims.create({
            key: 'beholder_idle',
            frames: [{ key: 'beholder_0' }, { key: 'beholder_1' }],
            frameRate: 4,
            repeat: -1
        });
        this.anims.create({
            key: 'goblin_sniper_walk',
            frames: [{ key: 'goblin_sniper_0' }, { key: 'goblin_sniper_1' }],
            frameRate: 5,
            repeat: -1
        });
        this.anims.create({
            key: 'goblin_berserker_walk',
            frames: [{ key: 'goblin_berserker_0' }, { key: 'goblin_berserker_1' }],
            frameRate: 7,
            repeat: -1
        });
        this.anims.create({
            key: 'fire_elemental_burn',
            frames: [
                { key: 'fire_elemental_0' }, { key: 'fire_elemental_1' },
                { key: 'fire_elemental_2' }, { key: 'fire_elemental_3' }
            ],
            frameRate: 12,
            repeat: -1
        });
        this.anims.create({
            key: 'necrotech_walk',
            frames: [{ key: 'necrotech_0' }, { key: 'necrotech_1' }],
            frameRate: 3,
            repeat: -1
        });
        this.anims.create({
            key: 'shadowmancer_float',
            frames: [
                { key: 'shadowmancer_0' }, { key: 'shadowmancer_1' },
                { key: 'shadowmancer_2' }, { key: 'shadowmancer_3' }
            ],
            frameRate: 5,
            repeat: -1
        });
        this.anims.create({
            key: 'death_knight_walk',
            frames: [{ key: 'death_knight_0' }, { key: 'death_knight_1' }],
            frameRate: 3,
            repeat: -1
        });
        this.anims.create({
            key: 'frost_giant_walk',
            frames: [
                { key: 'frost_giant_0' }, { key: 'frost_giant_1' },
                { key: 'frost_giant_2' }, { key: 'frost_giant_3' }
            ],
            frameRate: 4,
            repeat: -1
        });
        this.anims.create({
            key: 'balor_fly',
            frames: [{ key: 'balor_0' }, { key: 'balor_1' }],
            frameRate: 5,
            repeat: -1
        });

        /*
         * All character/enemy textures are now registered. Apply the
         * current graphics mode so HD/pixel filtering takes effect from
         * the very first frame of MainMenuScene (which renders portraits
         * via these textures).
         */
        graphicsMode.applyToTextures();

        this.scene.start('MainMenuScene');
    }
}
