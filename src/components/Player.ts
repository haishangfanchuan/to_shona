import * as Phaser from 'phaser';
import { CONSTANTS } from '../config/constants';
import { StepSoundGenerator } from './StepSoundGenerator';

export class Player {
    sprite: Phaser.Physics.Arcade.Sprite;
    private joystick: { getVelocityX: () => number } | null = null;
    private stepSound = new StepSoundGenerator(280);

    constructor(scene: Phaser.Scene, x: number, y: number) {
        this.sprite = scene.physics.add.sprite(x, y, 'player_sheet');
        this.sprite.setScale(1.5);
        this.sprite.setOrigin(0.5, 1);
        this.sprite.setCollideWorldBounds(false);
        (this.sprite.body as Phaser.Physics.Arcade.Body).setMaxVelocityX(CONSTANTS.SPEED.PLAYER_MAX);

        if (this.sprite.anims.exists('player_walk')) {
            this.sprite.play('player_walk');
        }
    }

    bindJoystick(joystick: { getVelocityX: () => number }) {
        this.joystick = joystick;
    }

    update() {
        if (!this.joystick) return;
        const vx = this.joystick.getVelocityX();
        this.sprite.setVelocityX(vx);

        if (Math.abs(vx) < 1) {
            this.sprite.setVelocityX(0);
            if (this.sprite.anims.isPlaying && this.sprite.anims.currentAnim?.key === 'player_walk') {
                this.sprite.anims.pause();
            }
        } else {
            if (!this.sprite.anims.isPlaying || this.sprite.anims.currentAnim?.key !== 'player_walk') {
                this.sprite.play('player_walk');
            }
            this.sprite.setFlipX(vx < 0);
            this.stepSound.play(0.25);
        }
    }

    disableInput() {
        this.joystick = null;
        this.sprite.setVelocityX(CONSTANTS.SPEED.NPC_WALK);
        this.sprite.play('player_walk');
    }

    getX() { return this.sprite.x; }
}
