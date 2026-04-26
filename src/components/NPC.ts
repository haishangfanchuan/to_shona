import * as Phaser from 'phaser';
import { CONSTANTS } from '../config/constants';
import { StepSoundGenerator } from './StepSoundGenerator';

const MAX_HEAR_DIST = 200;

export class NPC {
    sprite: Phaser.Physics.Arcade.Sprite;
    private isPaused = false;
    private stepSound = new StepSoundGenerator(320);

    constructor(scene: Phaser.Scene, x: number, y: number) {
        this.sprite = scene.physics.add.sprite(x, y, 'npc_sheet');
        this.sprite.setScale(0.135);
        this.sprite.setOrigin(0.5, 1);
        this.sprite.setCollideWorldBounds(false);
        (this.sprite.body as Phaser.Physics.Arcade.Body).setMaxVelocityX(CONSTANTS.SPEED.NPC_WALK);

        this.startWalk();
    }

    startWalk() {
        this.isPaused = false;
        this.sprite.setVelocityX(CONSTANTS.SPEED.NPC_WALK);
        if (!this.sprite.anims.isPlaying || this.sprite.anims.currentAnim?.key !== 'npc_walk') {
            this.sprite.play('npc_walk');
        }
    }

    stopWalkLowHead() {
        this.isPaused = true;
        this.sprite.setVelocityX(0);
        this.sprite.play('npc_idle_lowhead');
    }

    resumeWalk() {
        if (!this.isPaused) return;
        this.startWalk();
    }

    forceAutoWalk() {
        this.sprite.setVelocityX(CONSTANTS.SPEED.NPC_WALK);
        if (!this.sprite.anims.isPlaying || this.sprite.anims.currentAnim?.key !== 'npc_walk') {
            this.sprite.play('npc_walk');
        }
    }

    playStepSound(playerX: number) {
        if (this.isPaused) return;
        const dist = Math.abs(this.sprite.x - playerX);
        if (dist >= MAX_HEAR_DIST) return;
        const vol = 0.2 * (1 - dist / MAX_HEAR_DIST);
        this.stepSound.play(vol);
    }

    getX() { return this.sprite.x; }
    getIsPaused() { return this.isPaused; }
}
