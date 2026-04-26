import * as Phaser from 'phaser';
import { CONSTANTS } from '../config/constants';

export class TitleScene extends Phaser.Scene {
    private raindrops: { img: Phaser.GameObjects.Image; vy: number }[] = [];

    constructor() {
        super({ key: 'TitleScene' });
    }

    create() {
        const cx = CONSTANTS.SCREEN_WIDTH / 2;
        const cy = CONSTANTS.SCREEN_HEIGHT / 2;
        const W = CONSTANTS.SCREEN_WIDTH;
        const H = CONSTANTS.SCREEN_HEIGHT;

        // --- Background: early dawn gradient ---
        const bg = this.add.graphics();
        // Upper sky: deep cool blue-grey before dawn
        bg.fillGradientStyle(0x1a2035, 0x1a2035, 0x3a4a68, 0x3a4a68, 1);
        bg.fillRect(0, 0, W, H * 0.35);
        // Horizon: pale pink-orange dawn glow
        bg.fillGradientStyle(0x3a4a68, 0x3a4a68, 0xd49078, 0xd49078, 1);
        bg.fillRect(0, H * 0.35, W, H * 0.15);
        // Below horizon: fading cool dawn
        bg.fillGradientStyle(0xd49078, 0xd49078, 0x141018, 0x141018, 1);
        bg.fillRect(0, H * 0.50, W, H * 0.50);

        // --- Dawn glow near horizon ---
        const sunGlow = this.add.circle(cx, H * 0.50, 50, 0xd49078, 0.1);
        this.tweens.add({
            targets: sunGlow,
            alpha: 0.2,
            duration: 4000,
            yoyo: true,
            repeat: -1
        });

        // --- City silhouette ---
        this.drawCityline(H);

        // --- Figures sitting on rooftop ---
        // Central building rooftop (x:120, w:160, h:100) -> top at baseY - 100
        const roofTopY = H * 0.60 - 100;
        this.add.image(cx - 38, roofTopY, 'npc_sit').setOrigin(0.5, 1 - 0.25).setScale(0.04).setDepth(5);
        this.add.image(cx + 38, roofTopY, 'player_sit').setOrigin(0.5, 1 - 0.25).setScale(0.04).setDepth(5);

        // --- Distant warm lights ---
        const lights = [60, 120, 180, 250, 310, 350];
        for (const lx of lights) {
            const ly = H * 0.54 + Phaser.Math.Between(-8, 4);
            const dot = this.add.circle(lx, ly, 1.5, 0xFFCCAA, Phaser.Math.FloatBetween(0.15, 0.4));
            this.tweens.add({
                targets: dot,
                alpha: Phaser.Math.FloatBetween(0.1, 0.2),
                duration: Phaser.Math.Between(1500, 3000),
                yoyo: true,
                repeat: -1
            });
        }

        // --- Ground ---
        const ground = this.add.graphics();
        ground.fillStyle(0x141018, 1);
        ground.fillRect(0, H * 0.58, W, H * 0.42);

        // --- Rain particles ---
        this.createRainTexture();
        for (let i = 0; i < 60; i++) {
            this.spawnRaindrop(true);
        }

        // --- Title: "步履之间" with glow ---
        // Glow layer (larger, blurred feel)
        const titleGlow = this.add.text(cx, cy - 140, '步履之间', {
            fontSize: '48px',
            color: '#FFCCAA',
            fontFamily: 'serif',
        }).setOrigin(0.5).setAlpha(0.15);

        this.tweens.add({
            targets: titleGlow,
            alpha: 0.25,
            duration: 2000,
            yoyo: true,
            repeat: -1
        });

        // Main title
        this.add.text(cx, cy - 140, '步履之间', {
            fontSize: '44px',
            color: '#FFCCAA',
            fontFamily: 'serif',
        }).setOrigin(0.5);

        // --- "点击屏幕开始" hint ---
        const hint = this.add.text(cx, cy + 160, '点击屏幕开始', {
            fontSize: '18px',
            color: '#666666',
            fontFamily: 'serif',
        }).setOrigin(0.5);

        this.tweens.add({
            targets: hint,
            alpha: 0.3,
            duration: 1000,
            yoyo: true,
            repeat: -1,
        });

        // --- Game tip ---
        this.add.text(cx, cy + 185, '滑动长按屏幕或方向键移动', {
            fontSize: '14px',
            color: '#555555',
            fontFamily: 'serif',
        }).setOrigin(0.5).setAlpha(0.6);

        // --- Fade in whole scene ---
        this.cameras.main.fadeIn(800, 0, 0, 0);

        // --- Start game on click ---
        this.input.once('pointerdown', () => {
            this.cameras.main.fadeOut(500, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.scene.start('StreetScene');
            });
        });

        const bgm = this.sound.add('bgm_street', { loop: true, volume: 0.6 });
        bgm.play();
    }

    update() {
        const delta = this.game.loop.delta / 400;
        for (const r of this.raindrops) {
            r.img.y += r.vy * delta;
            r.img.x += 0.8 * delta; // slight wind drift
            if (r.img.y > CONSTANTS.SCREEN_HEIGHT + 10) {
                r.img.destroy();
                this.raindrops.splice(this.raindrops.indexOf(r), 1);
                this.spawnRaindrop(false);
            }
        }
    }

    private drawCityline(H: number) {
        const g = this.add.graphics();
        const baseY = H * 0.60;

        // Building fill — dark blue-grey silhouette
        g.fillStyle(0x12141e, 1);
        const buildings = [
            // Left side
            { x: 0, w: 35, h: 55 },
            { x: 30, w: 28, h: 80 },
            { x: 53, w: 32, h: 45 },
            { x: 80, w: 22, h: 95 },
            // Central wide building (for sitting figures)
            { x: 120, w: 160, h: 100 },
            // Right side
            { x: 275, w: 25, h: 85 },
            { x: 295, w: 40, h: 50 },
            { x: 330, w: 30, h: 70 },
            { x: 355, w: 30, h: 55 },
        ];
        for (const b of buildings) {
            g.fillRect(b.x, baseY - b.h, b.w, b.h);
        }

        // Antenna / rooftop details
        g.fillStyle(0x12141e, 1);
        g.fillRect(40, baseY - 80 - 12, 2, 12);   // antenna on building x:30
        g.fillRect(88, baseY - 95 - 15, 2, 15);    // antenna on building x:80
        g.fillRect(280, baseY - 85 - 10, 2, 10);   // antenna on building x:275

        // Tiny early-morning window lights
        g.fillStyle(0xd49078, 0.4);
        const windowLights = [
            { x: 140, y: baseY - 20 }, { x: 155, y: baseY - 35 },
            { x: 180, y: baseY - 25 }, { x: 210, y: baseY - 40 },
            { x: 250, y: baseY - 18 }, { x: 135, y: baseY - 55 },
            { x: 195, y: baseY - 60 }, { x: 230, y: baseY - 50 },
            { x: 45, y: baseY - 30 }, { x: 33, y: baseY - 50 },
            { x: 85, y: baseY - 40 }, { x: 300, y: baseY - 25 },
            { x: 340, y: baseY - 30 }, { x: 360, y: baseY - 20 },
        ];
        for (const w of windowLights) {
            g.fillRect(w.x, w.y, 3, 3);
        }
    }

    private createRainTexture() {
        const key = '__title_rain';
        if (this.textures.exists(key)) this.textures.remove(key);
        const g = this.add.graphics();
        g.fillStyle(0xC0D0E8, 0.6);
        g.fillRect(0, 0, 1, 6);
        g.generateTexture(key, 1, 6);
        g.destroy();
    }

    private spawnRaindrop(randomY: boolean) {
        const x = Phaser.Math.Between(-10, CONSTANTS.SCREEN_WIDTH + 10);
        const y = randomY ? Phaser.Math.Between(-10, CONSTANTS.SCREEN_HEIGHT) : Phaser.Math.Between(-60, -5);
        const alpha = Phaser.Math.FloatBetween(0.1, 0.35);
        const scale = Phaser.Math.FloatBetween(0.6, 1.4);
        const vy = Phaser.Math.FloatBetween(20, 35);

        const img = this.add.image(x, y, '__title_rain')
            .setScale(scale)
            .setAlpha(alpha)
            .setDepth(10)
            .setScrollFactor(0)
            .setAngle(8); // slight slant for wind

        this.raindrops.push({ img, vy });
    }
}
