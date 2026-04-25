import * as Phaser from 'phaser';
import { CONSTANTS } from '../config/constants';

interface Snowflake {
    img: Phaser.GameObjects.Image;
    vx: number;
    vy: number;
    wobbleOffset: number;
    wobbleSpeed: number;
    wobbleAmp: number;
    depth: number;
}

export class SnowEffect {
    private scene: Phaser.Scene;
    private flakes: Snowflake[] = [];
    private textureKeys: string[] = [];
    private active = false;
    private stopping = false;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.createTextures();
    }

    private createTextures() {
        const keys = ['__snow_dot', '__snow_star', '__snow_glow'];
        // Remove existing textures to avoid conflicts
        for (const key of keys) {
            if (this.scene.textures.exists(key)) {
                this.scene.textures.remove(key);
            }
        }

        // Texture 1: small soft dot
        let g = this.scene.add.graphics();
        g.fillStyle(0xFFFFFF, 0.9);
        g.fillCircle(2, 2, 2);
        g.fillStyle(0xFFFFFF, 0.4);
        g.fillCircle(2, 2, 1);
        g.generateTexture('__snow_dot', 4, 4);
        g.destroy();

        // Texture 2: six-pointed star shape
        g = this.scene.add.graphics();
        g.lineStyle(1.5, 0xFFFFFF, 0.9);
        for (let a = 0; a < 6; a++) {
            const angle = (a * 60) * Math.PI / 180;
            g.lineBetween(6, 6, 6 + Math.cos(angle) * 5, 6 + Math.sin(angle) * 5);
        }
        g.fillStyle(0xFFFFFF, 0.6);
        g.fillCircle(6, 6, 1.5);
        g.generateTexture('__snow_star', 12, 12);
        g.destroy();

        // Texture 3: larger soft glow
        g = this.scene.add.graphics();
        g.fillStyle(0xFFFFFF, 0.6);
        g.fillCircle(4, 4, 4);
        g.fillStyle(0xFFFFFF, 0.3);
        g.fillCircle(4, 4, 3);
        g.fillStyle(0xFFFFFF, 0.8);
        g.fillCircle(4, 4, 1.5);
        g.generateTexture('__snow_glow', 8, 8);
        g.destroy();

        this.textureKeys = ['__snow_dot', '__snow_star', '__snow_glow'];
    }

    start() {
        if (this.active) return;
        this.active = true;
        this.stopping = false;
        for (let i = 0; i < 100; i++) {
            this.spawnFlake(true);
        }
    }

    stop() {
        this.stopping = true;
    }

    forceClear() {
        for (const f of this.flakes) {
            f.img.destroy();
        }
        this.flakes = [];
        this.active = false;
        this.stopping = false;
    }

    isActive() { return this.active; }

    update() {
        if (!this.active) return;

        const delta = this.scene.game.loop.delta / 400;

        for (let i = this.flakes.length - 1; i >= 0; i--) {
            const f = this.flakes[i];
            const wobble = Math.sin(this.scene.time.now / 1000 * f.wobbleSpeed + f.wobbleOffset) * f.wobbleAmp;
            f.img.x += (f.vx + wobble * 0.02) * delta;
            f.img.y += f.vy * delta;

            // Slow rotation for star flakes
            if (f.depth > 0) {
                f.img.rotation += 0.005 * delta * f.wobbleSpeed;
            }

            if (f.img.y > CONSTANTS.SCREEN_HEIGHT + 10 || f.img.x < -20 || f.img.x > CONSTANTS.SCREEN_WIDTH + 20) {
                f.img.destroy();
                this.flakes.splice(i, 1);
                if (!this.stopping) {
                    this.spawnFlake(false);
                }
            }
        }

        if (this.stopping && this.flakes.length === 0) {
            this.active = false;
            this.stopping = false;
        }
    }

    private spawnFlake(randomY: boolean) {
        const x = Phaser.Math.Between(-10, CONSTANTS.SCREEN_WIDTH + 10);
        const y = randomY ? Phaser.Math.Between(-10, CONSTANTS.SCREEN_HEIGHT) : Phaser.Math.Between(-80, -5);

        // 3 depth layers for parallax feel
        const depthRoll = Math.random();
        let scale: number, vy: number, vx: number, alpha: number, texIdx: number, depth: number;

        if (depthRoll < 0.5) {
            // Far: small, slow, faint
            scale = Phaser.Math.FloatBetween(0.4, 0.8);
            vy = Phaser.Math.FloatBetween(5, 12);
            vx = Phaser.Math.FloatBetween(-1, 1);
            alpha = Phaser.Math.FloatBetween(0.2, 0.5);
            texIdx = 0; // dot
            depth = -1;
        } else if (depthRoll < 0.85) {
            // Mid: medium
            scale = Phaser.Math.FloatBetween(0.8, 1.4);
            vy = Phaser.Math.FloatBetween(10, 20);
            vx = Phaser.Math.FloatBetween(-2, 2);
            alpha = Phaser.Math.FloatBetween(0.4, 0.7);
            texIdx = Math.random() < 0.5 ? 0 : 2; // dot or glow
            depth = 0;
        } else {
            // Near: large, detailed, slow rotation
            scale = Phaser.Math.FloatBetween(1.2, 2.0);
            vy = Phaser.Math.FloatBetween(12, 22);
            vx = Phaser.Math.FloatBetween(-2, 2);
            alpha = Phaser.Math.FloatBetween(0.6, 0.9);
            texIdx = 1; // star
            depth = 1;
        }

        const img = this.scene.add.image(x, y, this.textureKeys[texIdx])
            .setScale(scale)
            .setAlpha(alpha)
            .setDepth(depth === -1 ? 93 : depth === 0 ? 95 : 97)
            .setScrollFactor(0);

        this.flakes.push({
            img,
            vx,
            vy,
            depth,
            wobbleOffset: Math.random() * Math.PI * 2,
            wobbleSpeed: Phaser.Math.FloatBetween(0.3, 1.0),
            wobbleAmp: depth === 1 ? 12 : depth === 0 ? 8 : 4,
        });
    }
}
