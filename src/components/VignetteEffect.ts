import * as Phaser from 'phaser';
import { CONSTANTS } from '../config/constants';

export class VignetteEffect {
    private image: Phaser.GameObjects.Image;

    constructor(scene: Phaser.Scene) {
        this.image = scene.add.image(
            CONSTANTS.SCREEN_WIDTH / 2,
            CONSTANTS.SCREEN_HEIGHT / 2,
            'vignette'
        );
        this.image.setAlpha(0);
        this.image.setScrollFactor(0);
        this.image.setDepth(90);
    }

    fadeIn() {
        const newAlpha = Math.min(1, this.image.alpha + 0.02);
        this.image.setAlpha(newAlpha);
    }

    fadeOut() {
        const newAlpha = Math.max(0, this.image.alpha - 0.05);
        this.image.setAlpha(newAlpha);
    }

    setAlpha(a: number) {
        this.image.setAlpha(a);
    }

    getAlpha() { return this.image.alpha; }
}
