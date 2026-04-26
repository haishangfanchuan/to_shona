import * as Phaser from 'phaser';
import { CONSTANTS } from '../config/constants';

export class TitleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TitleScene' });
    }

    create() {
        const cx = CONSTANTS.SCREEN_WIDTH / 2;
        const cy = CONSTANTS.SCREEN_HEIGHT / 2;

        this.cameras.main.setBackgroundColor('#1a1020');

        this.add.text(cx, cy - 80, '街角的话', {
            fontSize: '44px',
            color: '#FFB088',
            fontFamily: 'serif'
        }).setOrigin(0.5);

        this.add.text(cx, cy, 'Words at the Corner', {
            fontSize: '18px',
            color: '#aa8866',
            fontFamily: 'serif'
        }).setOrigin(0.5);

        const hint = this.add.text(cx, cy + 120, '点击屏幕开始', {
            fontSize: '18px',
            color: '#666666',
            fontFamily: 'serif'
        }).setOrigin(0.5);

        this.tweens.add({
            targets: hint,
            alpha: 0.3,
            duration: 1000,
            yoyo: true,
            repeat: -1
        });

        this.input.once('pointerdown', () => {
            this.cameras.main.fadeOut(500, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.scene.start('CityNightScene');
            });
        });
    }
}
