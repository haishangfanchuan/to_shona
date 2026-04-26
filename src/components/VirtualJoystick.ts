import * as Phaser from 'phaser';
import { CONSTANTS } from '../config/constants';

export class VirtualJoystick {
    private scene: Phaser.Scene;
    private touchActive = false;
    private startX = 0;
    private currentX = 0;

    // On-screen buttons
    private btnLeft!: Phaser.GameObjects.Container;
    private btnRight!: Phaser.GameObjects.Container;
    private leftBg!: Phaser.GameObjects.Rectangle;
    private rightBg!: Phaser.GameObjects.Rectangle;
    private leftArrow!: Phaser.GameObjects.Text;
    private rightArrow!: Phaser.GameObjects.Text;
    private btnLeftPressed = false;
    private btnRightPressed = false;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;

        // Touch / pointer swipe controls
        this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.y < CONSTANTS.SCREEN_HEIGHT - 100) {
                this.touchActive = true;
                this.startX = pointer.x;
                this.currentX = pointer.x;
            }
        });

        this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (this.touchActive) {
                this.currentX = pointer.x;
            }
        });

        this.scene.input.on('pointerup', () => {
            this.touchActive = false;
            this.currentX = 0;
            this.startX = 0;
        });

        // On-screen left/right buttons
        const btnY = CONSTANTS.SCREEN_HEIGHT - 30;
        const btnW = 50;
        const btnH = 30;

        // Left button
        this.leftBg = scene.add.rectangle(0, 0, btnW, btnH, 0xffffff, 0.2)
            .setStrokeStyle(2, 0xffffff, 0.4);
        this.leftBg.isFilled = true;
        this.leftBg.isStroked = true;
        this.leftArrow = scene.add.text(0, 0, '◀', {
            fontSize: '18px', color: '#ffffff', fontFamily: 'sans-serif'
        }).setOrigin(0.5);
        this.btnLeft = scene.add.container(35, btnY, [this.leftBg, this.leftArrow])
            .setScrollFactor(0).setDepth(500).setSize(btnW, btnH);

        // Right button
        this.rightBg = scene.add.rectangle(0, 0, btnW, btnH, 0xffffff, 0.2)
            .setStrokeStyle(2, 0xffffff, 0.4);
        this.rightBg.isFilled = true;
        this.rightBg.isStroked = true;
        this.rightArrow = scene.add.text(0, 0, '▶', {
            fontSize: '18px', color: '#ffffff', fontFamily: 'sans-serif'
        }).setOrigin(0.5);
        this.btnRight = scene.add.container(CONSTANTS.SCREEN_WIDTH - 35, btnY, [this.rightBg, this.rightArrow])
            .setScrollFactor(0).setDepth(500).setSize(btnW, btnH);

        // Make buttons interactive
        this.btnLeft.setInteractive({ useHandCursor: true });
        this.btnRight.setInteractive({ useHandCursor: true });

        this.btnLeft.on('pointerdown', () => {
            this.btnLeftPressed = true;
            this.updateButtonStyle(this.leftBg, this.leftArrow, true);
        });
        this.btnLeft.on('pointerup', () => {
            this.btnLeftPressed = false;
            this.updateButtonStyle(this.leftBg, this.leftArrow, false);
        });
        this.btnLeft.on('pointerout', () => {
            this.btnLeftPressed = false;
            this.updateButtonStyle(this.leftBg, this.leftArrow, false);
        });

        this.btnRight.on('pointerdown', () => {
            this.btnRightPressed = true;
            this.updateButtonStyle(this.rightBg, this.rightArrow, true);
        });
        this.btnRight.on('pointerup', () => {
            this.btnRightPressed = false;
            this.updateButtonStyle(this.rightBg, this.rightArrow, false);
        });
        this.btnRight.on('pointerout', () => {
            this.btnRightPressed = false;
            this.updateButtonStyle(this.rightBg, this.rightArrow, false);
        });

        // Keyboard support (A/D, Arrow keys)
        if (this.scene.input.keyboard) {
            this.scene.input.keyboard.on('keydown-A', () => {
                this.btnLeftPressed = true;
                this.updateButtonStyle(this.leftBg, this.leftArrow, true);
            });
            this.scene.input.keyboard.on('keyup-A', () => {
                this.btnLeftPressed = false;
                this.updateButtonStyle(this.leftBg, this.leftArrow, false);
            });
            this.scene.input.keyboard.on('keydown-D', () => {
                this.btnRightPressed = true;
                this.updateButtonStyle(this.rightBg, this.rightArrow, true);
            });
            this.scene.input.keyboard.on('keyup-D', () => {
                this.btnRightPressed = false;
                this.updateButtonStyle(this.rightBg, this.rightArrow, false);
            });
            this.scene.input.keyboard.on('keydown-LEFT', () => {
                this.btnLeftPressed = true;
                this.updateButtonStyle(this.leftBg, this.leftArrow, true);
            });
            this.scene.input.keyboard.on('keyup-LEFT', () => {
                this.btnLeftPressed = false;
                this.updateButtonStyle(this.leftBg, this.leftArrow, false);
            });
            this.scene.input.keyboard.on('keydown-RIGHT', () => {
                this.btnRightPressed = true;
                this.updateButtonStyle(this.rightBg, this.rightArrow, true);
            });
            this.scene.input.keyboard.on('keyup-RIGHT', () => {
                this.btnRightPressed = false;
                this.updateButtonStyle(this.rightBg, this.rightArrow, false);
            });
        }
    }

    private updateButtonStyle(bg: Phaser.GameObjects.Rectangle, arrow: Phaser.GameObjects.Text, pressed: boolean) {
        if (pressed) {
            bg.fillAlpha = 0.4;
            bg.strokeAlpha = 0.7;
            arrow.setScale(1.1);
        } else {
            bg.fillAlpha = 0.2;
            bg.strokeAlpha = 0.4;
            arrow.setScale(1);
        }
    }

    getVelocityX(): number {
        if (this.btnLeftPressed) return -CONSTANTS.SPEED.PLAYER_MAX;
        if (this.btnRightPressed) return CONSTANTS.SPEED.PLAYER_MAX;

        if (!this.touchActive) return 0;
        const worldDelta = this.scene.cameras.main.getWorldPoint(this.currentX, 0).x
            - this.scene.cameras.main.getWorldPoint(this.startX, 0).x;
        const normalized = Phaser.Math.Clamp(worldDelta / 40, -1, 1);
        return normalized * CONSTANTS.SPEED.PLAYER_MAX;
    }

    disable() {
        this.touchActive = false;
        this.btnLeftPressed = false;
        this.btnRightPressed = false;
        this.btnLeft.setVisible(false);
        this.btnRight.setVisible(false);
    }

    enable() {
        this.btnLeft.setVisible(true);
        this.btnRight.setVisible(true);
    }

    destroy() {
        this.scene.input.off('pointerdown');
        this.scene.input.off('pointermove');
        this.scene.input.off('pointerup');
        this.btnLeft.destroy();
        this.btnRight.destroy();
    }
}
