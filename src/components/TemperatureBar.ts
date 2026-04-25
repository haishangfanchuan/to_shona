import * as Phaser from 'phaser';
import { CONSTANTS } from '../config/constants';

const BAR_WIDTH = 160;
const BAR_HEIGHT = 16;
const BAR_RADIUS = 8;
const GLOW_PAD = 4;

export class TemperatureBar {
    private value: number;
    private isFrozen = false;
    private bg: Phaser.GameObjects.Graphics;
    private fill: Phaser.GameObjects.Graphics;
    private glow: Phaser.GameObjects.Graphics;
    private gloss: Phaser.GameObjects.Graphics;
    private border: Phaser.GameObjects.Graphics;
    private freezeOverlay: Phaser.GameObjects.Graphics;
    private freezePulse = 0;
    private shimmerX = -BAR_WIDTH;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        this.value = CONSTANTS.TEMPERATURE.INIT;

        // Outer glow (behind bar)
        this.glow = scene.add.graphics();
        this.glow.setPosition(x, y);
        this.glow.setDepth(98);

        // Background
        this.bg = scene.add.graphics();
        this.bg.setPosition(x, y);
        this.bg.setDepth(99);
        this.drawBg();

        // Fill bar
        this.fill = scene.add.graphics();
        this.fill.setPosition(x, y);
        this.fill.setDepth(100);

        // Gloss highlight
        this.gloss = scene.add.graphics();
        this.gloss.setPosition(x, y);
        this.gloss.setDepth(101);

        // Border
        this.border = scene.add.graphics();
        this.border.setPosition(x, y);
        this.border.setDepth(102);

        // Freeze overlay
        this.freezeOverlay = scene.add.graphics();
        this.freezeOverlay.setPosition(x, y);
        this.freezeOverlay.setDepth(103);

        this.draw();

        // Shimmer tween: sweep highlight across bar
        scene.tweens.addCounter({
            from: -BAR_WIDTH,
            to: BAR_WIDTH + 40,
            duration: 2500,
            repeat: -1,
            ease: 'Sine.easeInOut',
            onUpdate: (tween) => {
                const v = tween.getValue();
                if (v != null) this.shimmerX = v;
                this.draw();
            }
        });

        // Freeze pulse tween
        scene.tweens.addCounter({
            from: 0,
            to: Math.PI * 2,
            duration: 1200,
            repeat: -1,
            onUpdate: (tween) => {
                if (this.isFrozen) {
                    const v = tween.getValue();
                    if (v != null) this.freezePulse = v;
                    this.drawFreezeOverlay();
                }
            }
        });
    }

    increase() {
        if (this.isFrozen) {
            this.value = Math.min(CONSTANTS.TEMPERATURE.MAX, this.value + CONSTANTS.TEMPERATURE.SYNC_RECOVERY_RATE);
            this.draw();
            return;
        }
        this.value = Math.min(CONSTANTS.TEMPERATURE.MAX, this.value + CONSTANTS.TEMPERATURE.SYNC_RECOVERY_RATE);
        this.draw();
    }

    decrease() {
        if (this.isFrozen) return;
        this.value = Math.max(0, this.value - CONSTANTS.TEMPERATURE.FAR_DECAY_RATE);
        this.draw();
    }

    decreaseFast() {
        if (this.isFrozen) return;
        this.value = Math.max(0, this.value - CONSTANTS.TEMPERATURE.FAR_DECAY_RATE);
        this.draw();
    }

    addBonus(amount: number) {
        this.value = Math.min(CONSTANTS.TEMPERATURE.MAX, this.value + amount);
        this.draw();
    }

    freeze() {
        this.isFrozen = true;
        this.freezeOverlay.setAlpha(1);
    }
    unfreeze() {
        this.isFrozen = false;
        this.freezeOverlay.clear();
        this.freezeOverlay.setAlpha(0);
    }
    getIsFrozen() { return this.isFrozen; }

    getValue() { return this.value; }

    setScrollFactor(x: number, y: number) {
        this.bg.setScrollFactor(x, y);
        this.fill.setScrollFactor(x, y);
        this.gloss.setScrollFactor(x, y);
        this.border.setScrollFactor(x, y);
        this.glow.setScrollFactor(x, y);
        this.freezeOverlay.setScrollFactor(x, y);
    }

    private drawBg() {
        this.bg.clear();
        // Dark background with inner shadow feel
        this.bg.fillStyle(0x1a1a2e, 0.9);
        this.bg.fillRoundedRect(0, 0, BAR_WIDTH, BAR_HEIGHT, BAR_RADIUS);
        // Subtle inner highlight at top
        this.bg.fillStyle(0xffffff, 0.04);
        this.bg.fillRoundedRect(2, 1, BAR_WIDTH - 4, BAR_HEIGHT / 2 - 1, BAR_RADIUS - 2);
    }

    private getColor(ratio: number): { r: number; g: number; b: number } {
        let r: number, g: number, b: number;
        if (ratio < 0.25) {
            const t = ratio / 0.25;
            r = Math.floor(40 + 20 * t);
            g = Math.floor(100 + 60 * t);
            b = Math.floor(220 + 35 * t);
        } else if (ratio < 0.5) {
            const t = (ratio - 0.25) / 0.25;
            r = Math.floor(60 + 160 * t);
            g = Math.floor(160 - 40 * t);
            b = Math.floor(255 - 180 * t);
        } else if (ratio < 0.75) {
            const t = (ratio - 0.5) / 0.25;
            r = 255;
            g = Math.floor(120 + 50 * t);
            b = Math.floor(75 - 30 * t);
        } else {
            const t = (ratio - 0.75) / 0.25;
            r = 255;
            g = Math.floor(170 + 50 * t);
            b = Math.floor(45 + 20 * t);
        }
        return { r, g, b };
    }

    private draw() {
        this.fill.clear();
        this.gloss.clear();
        this.border.clear();
        this.glow.clear();

        const ratio = this.value / CONSTANTS.TEMPERATURE.MAX;
        const fillW = BAR_WIDTH * ratio;

        if (fillW < 1) {
            if (this.isFrozen) {
                this.border.lineStyle(1, 0xFFFFFF, 0.3);
                this.border.strokeRoundedRect(0, 0, BAR_WIDTH, BAR_HEIGHT, BAR_RADIUS);
            }
            return;
        }

        const col = this.getColor(ratio);
        const mainColor = Phaser.Display.Color.GetColor(col.r, col.g, col.b);

        // Vertical gradient: brighter at top, darker at bottom
        const steps = 8;
        const stepH = BAR_HEIGHT / steps;
        for (let i = 0; i < steps; i++) {
            const t = i / (steps - 1);
            const factor = 1.15 - 0.3 * t; // bright top, darker bottom
            const sr = Math.min(255, Math.floor(col.r * factor));
            const sg = Math.min(255, Math.floor(col.g * factor));
            const sb = Math.min(255, Math.floor(col.b * factor));
            this.fill.fillStyle(Phaser.Display.Color.GetColor(sr, sg, sb), 1);

            const sliceY = i * stepH;
            const sliceH = (i === steps - 1) ? BAR_HEIGHT - sliceY : stepH + 0.5;
            // Only draw within the fill width, clipped by rounded rect shape
            if (i === 0) {
                this.fill.fillStyle(Phaser.Display.Color.GetColor(sr, sg, sb), 1);
            }
            this.fill.fillRect(0, sliceY, fillW, sliceH);
        }

        // Re-draw rounded rect mask by clearing outside areas
        // Use fillRoundedRect with the gradient color approximated
        this.fill.clear();
        // Draw multiple thin horizontal strips for gradient
        for (let i = 0; i < steps; i++) {
            const t = i / (steps - 1);
            const factor = 1.2 - 0.4 * t;
            const sr = Math.min(255, Math.floor(col.r * factor));
            const sg = Math.min(255, Math.floor(col.g * factor));
            const sb = Math.min(255, Math.floor(col.b * factor));
            this.fill.fillStyle(Phaser.Display.Color.GetColor(sr, sg, sb), 1);

            const sliceY = Math.floor(i * BAR_HEIGHT / steps);
            const nextY = Math.floor((i + 1) * BAR_HEIGHT / steps);
            const sliceH = nextY - sliceY;

            // For top and bottom strips, use rounded corners
            if (i === 0) {
                this.fill.fillRoundedRect(0, sliceY, fillW, sliceH + 1, { tl: BAR_RADIUS, tr: BAR_RADIUS, bl: 0, br: 0 });
            } else if (i === steps - 1) {
                this.fill.fillRoundedRect(0, sliceY, fillW, sliceH + 1, { tl: 0, tr: 0, bl: BAR_RADIUS, br: BAR_RADIUS });
            } else {
                this.fill.fillRect(0, sliceY, fillW, sliceH + 1);
            }
        }

        // Gloss highlight: thin bright strip at top + shimmer sweep
        this.gloss.fillStyle(0xffffff, 0.25);
        this.gloss.fillRoundedRect(2, 1, fillW - 4, 5, 3);

        // Shimmer: a narrow bright band that sweeps across
        if (this.shimmerX > 0 && this.shimmerX < fillW) {
            const shimW = 30;
            const sx = Math.max(0, this.shimmerX - shimW / 2);
            const sw = Math.min(shimW, fillW - sx);
            if (sw > 0) {
                this.gloss.fillStyle(0xffffff, 0.18);
                this.gloss.fillRect(sx, 0, sw, BAR_HEIGHT);
            }
        }

        // Border
        const borderAlpha = this.isFrozen ? 0.4 + 0.2 * Math.sin(this.freezePulse) : 0.5;
        const borderColor = this.isFrozen ? 0x88ccff : 0xffffff;
        this.border.lineStyle(1.5, borderColor, borderAlpha);
        this.border.strokeRoundedRect(0, 0, BAR_WIDTH, BAR_HEIGHT, BAR_RADIUS);

        // Glow when warm (ratio > 0.5)
        if (ratio > 0.4) {
            const glowAlpha = (ratio - 0.4) * 0.35;
            this.glow.fillStyle(mainColor, glowAlpha);
            this.glow.fillRoundedRect(
                -GLOW_PAD, -GLOW_PAD,
                BAR_WIDTH + GLOW_PAD * 2, BAR_HEIGHT + GLOW_PAD * 2,
                BAR_RADIUS + GLOW_PAD
            );
        }

        // Frozen ice crystals overlay
        if (this.isFrozen) {
            this.drawFreezeOverlay();
        }
    }

    private drawFreezeOverlay() {
        this.freezeOverlay.clear();
        if (!this.isFrozen) return;

        const pulse = 0.08 + 0.06 * Math.sin(this.freezePulse);
        // Icy overlay
        this.freezeOverlay.fillStyle(0x88ccff, pulse);
        this.freezeOverlay.fillRoundedRect(0, 0, BAR_WIDTH, BAR_HEIGHT, BAR_RADIUS);

        // Ice crystal lines
        const crystalAlpha = 0.15 + 0.1 * Math.sin(this.freezePulse * 1.3);
        this.freezeOverlay.lineStyle(1, 0xccddff, crystalAlpha);
        // Small diagonal lines to simulate frost
        this.freezeOverlay.lineBetween(20, 3, 28, 13);
        this.freezeOverlay.lineBetween(50, 2, 56, 10);
        this.freezeOverlay.lineBetween(80, 4, 88, 14);
        this.freezeOverlay.lineBetween(110, 1, 118, 11);
        this.freezeOverlay.lineBetween(135, 3, 140, 9);
    }
}
