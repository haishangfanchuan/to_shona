import * as Phaser from 'phaser';
import { CONSTANTS } from '../config/constants';

export class BootScene extends Phaser.Scene {
    private loadingBar!: Phaser.GameObjects.Graphics;

    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        this.loadingBar = this.add.graphics();
        this.load.on('progress', (value: number) => {
            this.loadingBar.clear();
            this.loadingBar.fillStyle(0xFFB088, 1);
            this.loadingBar.fillRect(
                CONSTANTS.SCREEN_WIDTH * 0.2,
                CONSTANTS.SCREEN_HEIGHT / 2,
                CONSTANTS.SCREEN_WIDTH * 0.6 * value,
                4
            );
        });
        this.load.on('complete', () => {
            this.loadingBar.destroy();
        });
        // Player spritesheet (32x32 per frame, 4 frames)
        this.load.spritesheet('player_sheet', 'assets/images/play.png', {
            frameWidth: 32, frameHeight: 32
        });
        this.load.spritesheet('npc_sheet', 'assets/images/npc.png', {
            frameWidth: 32, frameHeight: 32
        });

        // Backgrounds
        this.load.image('bg_street', 'assets/images/bg_street.png');
        this.load.image('bg_city', 'assets/images/scene_2/bg_city_stitched.png');
        this.load.image('bg_subway', 'assets/images/scene_2/bg_subway.png');

        // Sit/stand spritesheet (2 frames: bend, sit)
        this.load.spritesheet('npc_sit_stand', 'assets/images/npc_sit_stand.png', {
            frameWidth: 32, frameHeight: 32
        });

        // Sitting sprites (high-res: 2896x1448)
        this.load.image('npc_sit', 'assets/images/scene_2/npc_sit.png');
        this.load.image('player_sit', 'assets/images/scene_2/player_sit.png');

        // Subway NPC walking spritesheet (4 frames, ~444x887 each)
        this.load.spritesheet('npc_subway_walk', 'assets/images/npc_paly_subway.png', {
            frameWidth: 444, frameHeight: 887
        });

        // Subway player standing sprite (2896x1448)
        this.load.image('player_subway_stand', 'assets/images/paly_subway.png');

        // UI
        this.load.image('vignette', 'assets/images/vignette.png');
        this.load.spritesheet('emotes', 'assets/images/emotes..png', {
            frameWidth: 16, frameHeight: 16
        });
        this.load.spritesheet('bubble_dots', 'assets/images/bubble_dots.png', {
            frameWidth: 16, frameHeight: 16
        });
        this.load.image('bubble_exclaim', 'assets/images/bubble_exclaim.png');

        // Ending particles
        this.load.image('star_particle', 'assets/images/star_particle.png');
        this.load.image('heart_particle', 'assets/images/heart_particle.png');

        // Audio
        this.load.audio('bgm_street', 'assets/audio/bgm_street.mp3');
        this.load.audio('bgm_subway', 'assets/audio/bgm_sad_subway.wav');
        this.load.audio('bgm_happy', 'assets/audio/bgm_happy_subway.wav');
    }

    create() {
        // Player walk animation
        this.anims.create({
            key: 'player_walk',
            frames: this.anims.generateFrameNumbers('player_sheet', { start: 0, end: 3 }),
            frameRate: 8,
            repeat: -1
        });

        // NPC walk animations
        this.anims.create({
            key: 'npc_walk',
            frames: this.anims.generateFrameNumbers('npc_sheet', { start: 0, end: 3 }),
            frameRate: 8,
            repeat: -1
        });

        this.anims.create({
            key: 'npc_idle_lowhead',
            frames: [{ key: 'npc_sheet', frame: 0 }],
            frameRate: 1
        });

        this.anims.create({
            key: 'bubble_dots_anim',
            frames: this.anims.generateFrameNumbers('bubble_dots', { start: 0, end: 2 }),
            frameRate: 2,
            repeat: -1
        });

        // Sit/stand animations (shared by player and npc in SubwayScene)
        this.anims.create({
            key: 'sit_bend',
            frames: [{ key: 'npc_sit_stand', frame: 0 }],
            frameRate: 1
        });

        this.anims.create({
            key: 'sit_down',
            frames: [{ key: 'npc_sit_stand', frame: 1 }],
            frameRate: 1
        });

        // Subway NPC walking animation (4 frames, 4fps)
        this.anims.create({
            key: 'npc_subway_walk_anim',
            frames: this.anims.generateFrameNumbers('npc_subway_walk', { start: 0, end: 3 }),
            frameRate: 4,
            repeat: -1
        });

        this.scene.start('TitleScene');
    }
}
