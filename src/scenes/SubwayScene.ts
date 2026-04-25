import * as Phaser from 'phaser';
import { CONSTANTS } from '../config/constants';
import { DIALOGUES } from '../config/dialogues';
import { VignetteEffect } from '../components/VignetteEffect';
import { SnowEffect } from '../components/SnowEffect';
import { StepSoundGenerator } from '../components/StepSoundGenerator';
import { playWhisper } from '../components/SoundGenerators';
import { EmoteBubble } from '../components/EmoteBubble';

export class SubwayScene extends Phaser.Scene {
    private currentTemp = 100;
    private vignette!: VignetteEffect;
    private snow!: SnowEffect;

    private playerSprite!: Phaser.GameObjects.Image;
    private npcSprite!: Phaser.GameObjects.Image;
    private emoteBubble!: EmoteBubble;
    private emoteTurn: 'player' | 'npc' = 'npc';
    private emoteTimer?: Phaser.Time.TimerEvent;
    private lineIndex = 0;
    private floatingTexts: Phaser.GameObjects.Text[] = [];
    private hint!: Phaser.GameObjects.Text;
    private choicesVisible = false;

    private tempValue = 100;
    private tempBg!: Phaser.GameObjects.Graphics;
    private tempFill!: Phaser.GameObjects.Graphics;
    private tempGlow!: Phaser.GameObjects.Graphics;
    private tempGloss!: Phaser.GameObjects.Graphics;
    private tempBorder!: Phaser.GameObjects.Graphics;
    private snowStarted = false;
    private emoteStopped = false;

    constructor() {
        super({ key: 'SubwayScene' });
    }

    create(data: { currentTemp?: number }) {
        this.currentTemp = data.currentTemp ?? 25;
        this.lineIndex = 0;
        this.floatingTexts = [];
        this.choicesVisible = false;
        this.snowStarted = false;

        // 1. Static subway background (1085×1808)
        const subScale = CONSTANTS.SCREEN_WIDTH / 1085;
        const subOffX = 0;
        const subOffY = (CONSTANTS.SCREEN_HEIGHT - 1808 * subScale) / 2;
        this.add.image(subOffX, subOffY, 'bg_subway').setOrigin(0, 0).setScale(subScale);

        // 2. Vignette
        this.vignette = new VignetteEffect(this);
        if (this.currentTemp < 50) {
            this.vignette.setAlpha(0.6);
        }

        // 2.5 Snow (starts when temp hits 0)
        this.snow = new SnowEffect(this);

        // 2.6 Temperature bar — starts at 100, decays to 0 over 10s
        this.tempValue = 100;
        const barX = (CONSTANTS.SCREEN_WIDTH - 160) / 2;
        const barY = 20;
        const barW = 160;
        const barH = 16;
        const barR = 8;

        this.tempGlow = this.add.graphics().setScrollFactor(0).setDepth(98);
        this.tempBg = this.add.graphics().setScrollFactor(0).setDepth(99);
        this.tempBg.fillStyle(0x1a1a2e, 0.9);
        this.tempBg.fillRoundedRect(barX, barY, barW, barH, barR);
        this.tempBg.fillStyle(0xffffff, 0.04);
        this.tempBg.fillRoundedRect(barX + 2, barY + 1, barW - 4, barH / 2 - 1, barR - 2);

        this.tempFill = this.add.graphics().setScrollFactor(0).setDepth(100);
        this.tempGloss = this.add.graphics().setScrollFactor(0).setDepth(101);
        this.tempBorder = this.add.graphics().setScrollFactor(0).setDepth(102);
        this.drawTempBar(barX, barY, barW, barH, barR);

        // Tween temp from 100 to 0 over 10 seconds
        this.tweens.add({
            targets: this,
            tempValue: 0,
            duration: 5000,
            ease: 'Linear',
            onUpdate: () => {
                this.drawTempBar(barX, barY, barW, barH, barR);
            },
            onComplete: () => {
                if (!this.snowStarted) {
                    this.snowStarted = true;
                    this.snow.start();
                    // Restrict emotes when temp hits zero
                    this.emoteBubble.setRows(
                        [5, 8, 15],   // player: 第6、9、16排
                        [2, 4, 9],    // npc: 第3、5、10排
                    );
                    // Snow started — now show hint after a brief moment
                    this.time.delayedCall(1500, () => {
                        this.showHint();
                    });
                }
            }
        });

        // 3. Stop previous scene BGM, then play subway BGM
        this.sound.stopAll();
        const bgm = this.sound.add('bgm_subway', { loop: true, volume: 0.5 });
        bgm.play();

        // 4. Characters already sitting (high-res sprites: 2896x1448)
        // Scale: 0.033 × 1.5 × 1.5 = 0.075
        const sitScale = 0.1125;

        this.playerSprite = this.add.image(226, 490, 'player_sit')
            .setScale(sitScale)
            .setOrigin(0.5, 1)
            .setDepth(10);

        this.npcSprite = this.add.image(144, 490, 'npc_sit')
            .setScale(sitScale)
            .setOrigin(0.5, 1)
            .setDepth(10);

        // 5. Fade in from black
        this.cameras.main.fadeIn(1000, 0, 0, 0);

        // 6. Emote bubbles — player/npc alternating
        this.emoteBubble = new EmoteBubble(this);
        this.scheduleNextEmote();
    }

    private scheduleNextEmote() {
        this.time.delayedCall(800, () => {
            if (this.emoteStopped) return;
            if (this.emoteBubble.isActive) {
                this.scheduleNextEmote();
                return;
            }
            if (this.emoteTurn === 'npc') {
                this.emoteBubble.forceShow(this.npcSprite, 'npc');
            } else {
                this.emoteBubble.forceShow(this.playerSprite, 'player');
            }
            this.emoteTurn = this.emoteTurn === 'npc' ? 'player' : 'npc';
            this.scheduleNextEmote();
        });
    }

    private drawTempBar(x: number, y: number, w: number, h: number, r: number) {
        this.tempFill.clear();
        this.tempGloss.clear();
        this.tempBorder.clear();
        this.tempGlow.clear();
        const ratio = this.tempValue / 100;
        const fillW = w * ratio;
        if (fillW < 1) {
            this.tempBorder.lineStyle(1, 0xFFFFFF, 0.3);
            this.tempBorder.strokeRoundedRect(x, y, w, h, r);
            return;
        }

        // Color gradient: cold blue → warm orange
        let cr: number, cg: number, cb: number;
        if (ratio < 0.25) {
            const t = ratio / 0.25;
            cr = Math.floor(40 + 20 * t); cg = Math.floor(100 + 60 * t); cb = Math.floor(220 + 35 * t);
        } else if (ratio < 0.5) {
            const t = (ratio - 0.25) / 0.25;
            cr = Math.floor(60 + 160 * t); cg = Math.floor(160 - 40 * t); cb = Math.floor(255 - 180 * t);
        } else if (ratio < 0.75) {
            const t = (ratio - 0.5) / 0.25;
            cr = 255; cg = Math.floor(120 + 50 * t); cb = Math.floor(75 - 30 * t);
        } else {
            const t = (ratio - 0.75) / 0.25;
            cr = 255; cg = Math.floor(170 + 50 * t); cb = Math.floor(45 + 20 * t);
        }
        const mainColor = Phaser.Display.Color.GetColor(cr, cg, cb);

        // Vertical gradient fill (bright top → dark bottom)
        const steps = 8;
        for (let i = 0; i < steps; i++) {
            const t = i / (steps - 1);
            const factor = 1.2 - 0.4 * t;
            const sr = Math.min(255, Math.floor(cr * factor));
            const sg = Math.min(255, Math.floor(cg * factor));
            const sb = Math.min(255, Math.floor(cb * factor));
            this.tempFill.fillStyle(Phaser.Display.Color.GetColor(sr, sg, sb), 1);

            const sliceY = Math.floor(i * h / steps);
            const nextY = Math.floor((i + 1) * h / steps);
            const sliceH = nextY - sliceY;

            if (i === 0) {
                this.tempFill.fillRoundedRect(x, y + sliceY, fillW, sliceH + 1, { tl: r, tr: r, bl: 0, br: 0 });
            } else if (i === steps - 1) {
                this.tempFill.fillRoundedRect(x, y + sliceY, fillW, sliceH + 1, { tl: 0, tr: 0, bl: r, br: r });
            } else {
                this.tempFill.fillRect(x, y + sliceY, fillW, sliceH + 1);
            }
        }

        // Gloss highlight
        this.tempGloss.fillStyle(0xffffff, 0.25);
        this.tempGloss.fillRoundedRect(x + 2, y + 1, fillW - 4, 5, 3);

        // Border
        this.tempBorder.lineStyle(1.5, 0xffffff, 0.5);
        this.tempBorder.strokeRoundedRect(x, y, w, h, r);

        // Glow when warm
        if (ratio > 0.4) {
            const glowAlpha = (ratio - 0.4) * 0.35;
            this.tempGlow.fillStyle(mainColor, glowAlpha);
            this.tempGlow.fillRoundedRect(x - 4, y - 4, w + 8, h + 8, r + 4);
        }
    }

    update() {
        if (this.snowStarted) {
            this.snow.update();
        }
    }

    private showHint() {
        this.hint = this.add.text(
            CONSTANTS.SCREEN_WIDTH / 2, 580,
            '点击屏幕说出口', {
                fontSize: '18px',
                color: '#aaaaaa',
                fontFamily: 'serif'
            }
        ).setOrigin(0.5).setDepth(100);

        this.tweens.add({
            targets: this.hint,
            alpha: 0.3,
            duration: 800,
            yoyo: true,
            repeat: -1
        });

        this.input.on('pointerdown', this.onPointerDown, this);
    }

    private snowStopping = false;

    private onPointerDown() {
        if (this.lineIndex >= DIALOGUES.SUBWAY_APOLOGY.length) return;
        if (this.choicesVisible) return;

        // Stop emote bubbles once player starts talking
        this.emoteStopped = true;

        // Stop snow on first click, clear within 3s
        if (this.snowStarted && !this.snowStopping) {
            this.snowStopping = true;
            this.snow.stop();
            this.time.delayedCall(3000, () => {
                this.snow.forceClear();
                this.snowStarted = false;
            });
        }

        const textStr = DIALOGUES.SUBWAY_APOLOGY[this.lineIndex];
        const startX = this.playerSprite.x;
        const startY = this.playerSprite.y - 80;

        const textObj = this.add.text(startX, startY, textStr, {
            fontSize: '15px',
            color: '#FFFFFF',
            fontFamily: 'serif',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 3,
            wordWrap: { width: CONSTANTS.SCREEN_WIDTH - 40, useAdvancedWrap: true }
        }).setOrigin(0.5, 0.5).setAlpha(0).setDepth(50);

        const TEXT_AREA_BOTTOM = 295;
        const LINE_HEIGHT = 28;
        const targetX = CONSTANTS.SCREEN_WIDTH / 2;

        // Shift existing texts up by one line; fade out those leaving the area
        for (const old of this.floatingTexts) {
            const newY = old.y - LINE_HEIGHT;
            if (newY < 40) {
                this.tweens.add({
                    targets: old,
                    y: newY,
                    alpha: 0,
                    duration: 600,
                    ease: 'Sine.easeInOut',
                    onComplete: () => {
                        const idx = this.floatingTexts.indexOf(old);
                        if (idx !== -1) this.floatingTexts.splice(idx, 1);
                        old.destroy();
                    }
                });
            } else {
                this.tweens.add({
                    targets: old,
                    y: newY,
                    duration: 600,
                    ease: 'Cubic.easeInOut'
                });
            }
        }

        // Float the new text up to the bottom of the text area
        this.tweens.add({
            targets: textObj,
            x: targetX,
            y: TEXT_AREA_BOTTOM,
            alpha: 1,
            duration: 1500,
            ease: 'Sine.easeOut'
        });

        playWhisper();
        this.floatingTexts.push(textObj);
        this.lineIndex++;

        if (this.lineIndex >= DIALOGUES.SUBWAY_APOLOGY.length) {
            this.input.off('pointerdown', this.onPointerDown, this);
            this.time.delayedCall(2000, () => {
                this.triggerFinalPresentation();
            });
        }
    }

    private triggerFinalPresentation() {
        const container = this.add.container(
            CONSTANTS.SCREEN_WIDTH / 2, 0
        ).setDepth(50);

        for (const txt of this.floatingTexts) {
            txt.removeFromDisplayList();
            txt.x = txt.x - CONSTANTS.SCREEN_WIDTH / 2;
            container.add(txt);
        }

        this.tweens.add({
            targets: container,
            scaleX: { from: 0.98, to: 1.02 },
            scaleY: { from: 0.98, to: 1.02 },
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        if (this.currentTemp > 80) {
            const glow = this.add.circle(
                CONSTANTS.SCREEN_WIDTH / 2, 240,
                120, 0xFFDDAA, 0.15
            ).setDepth(45);

            this.tweens.add({
                targets: glow,
                alpha: { from: 0.1, to: 0.25 },
                scaleX: { from: 0.9, to: 1.1 },
                scaleY: { from: 0.9, to: 1.1 },
                duration: 2000,
                yoyo: true,
                repeat: -1
            });
        }

        if (this.hint) {
            this.hint.setVisible(false);
        }

        this.time.delayedCall(1500, () => {
            this.showChoiceButtons();
        });
    }

    private showChoiceButtons() {
        this.choicesVisible = true;
        if (this.emoteTimer) this.emoteTimer.remove();

        const btnY = 560;
        const btnW = 140;
        const btnH = 48;
        const radius = 12;

        // Helper: draw rounded rect
        const drawRounded = (g: Phaser.GameObjects.Graphics, w: number, h: number, r: number, fill: number, alpha: number, stroke: number, strokeAlpha: number) => {
            g.clear();
            g.fillStyle(fill, alpha);
            g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
            g.lineStyle(1.5, stroke, strokeAlpha);
            g.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
        };

        // Reject button — 灰色调
        const rejectGlow = this.add.graphics().setDepth(199);
        const rejectBg = this.add.graphics().setDepth(200);
        drawRounded(rejectBg, btnW, btnH, radius, 0x444450, 0.85, 0x8888aa, 0.5);
        const rejectText = this.add.text(0, 0, DIALOGUES.CHOICES.REJECT, {
            fontSize: '18px', color: '#bbbbcc', fontFamily: 'serif'
        }).setOrigin(0.5).setDepth(201);
        const rejectBtn = this.add.container(
            CONSTANTS.SCREEN_WIDTH / 2 - 85, btnY,
            [rejectBg, rejectText]
        ).setDepth(200).setAlpha(0);

        // Accept button — 淡绿色调
        const acceptGlow = this.add.graphics().setDepth(199);
        const acceptBg = this.add.graphics().setDepth(200);
        drawRounded(acceptBg, btnW, btnH, radius, 0x2a4030, 0.85, 0x6aaa7a, 0.5);
        const acceptText = this.add.text(0, 0, DIALOGUES.CHOICES.ACCEPT, {
            fontSize: '18px', color: '#8edd9a', fontFamily: 'serif'
        }).setOrigin(0.5).setDepth(201);
        const acceptBtn = this.add.container(
            CONSTANTS.SCREEN_WIDTH / 2 + 85, btnY,
            [acceptBg, acceptText]
        ).setDepth(200).setAlpha(0);

        // Float-in animation
        const targetRejectY = rejectBtn.y;
        const targetAcceptY = acceptBtn.y;
        rejectBtn.y += 30;
        acceptBtn.y += 30;
        this.tweens.add({
            targets: rejectBtn,
            alpha: 1, y: targetRejectY,
            duration: 600, ease: 'Back.easeOut'
        });
        this.tweens.add({
            targets: acceptBtn,
            alpha: 1, y: targetAcceptY,
            duration: 600, delay: 100, ease: 'Back.easeOut'
        });

        // Hover glow + scale effect
        const setupHover = (btn: Phaser.GameObjects.Container, glow: Phaser.GameObjects.Graphics, bg: Phaser.GameObjects.Graphics, strokeColor: number, glowColor: number, normalFill: number, hoverFill: number) => {
            btn.setSize(btnW, btnH).setInteractive({ useHandCursor: true });
            btn.on('pointerover', () => {
                this.tweens.add({ targets: btn, scaleX: 1.08, scaleY: 1.08, duration: 150, ease: 'Quad.easeOut' });
                drawRounded(bg, btnW, btnH, radius, hoverFill, 0.95, strokeColor, 0.9);
                glow.clear();
                glow.fillStyle(glowColor, 0.15);
                glow.fillRoundedRect(-btnW / 2 - 4, -btnH / 2 - 4, btnW + 8, btnH + 8, 12);
                glow.setPosition(btn.x, btn.y);
            });
            btn.on('pointerout', () => {
                this.tweens.add({ targets: btn, scaleX: 1, scaleY: 1, duration: 150, ease: 'Quad.easeOut' });
                drawRounded(bg, btnW, btnH, radius, normalFill, 0.85, strokeColor, 0.5);
                glow.clear();
            });
        };
        setupHover(rejectBtn, rejectGlow, rejectBg, 0x8888aa, 0x8888cc, 0x444450, 0x555568);
        setupHover(acceptBtn, acceptGlow, acceptBg, 0x6aaa7a, 0x6aaa7a44, 0x2a4030, 0x3a5840);

        // Particle sparkle effect around buttons
        const sparkles: Phaser.GameObjects.Graphics[] = [];
        const sparkleCount = 6;
        for (let i = 0; i < sparkleCount; i++) {
            const s = this.add.graphics().setDepth(199).setAlpha(0);
            const angle = (i / sparkleCount) * Math.PI * 2;
            const rx = 75;
            const ry = 35;
            s.setPosition(
                CONSTANTS.SCREEN_WIDTH / 2 + Math.cos(angle) * rx,
                btnY + Math.sin(angle) * ry
            );
            sparkles.push(s);
            this.tweens.add({
                targets: s,
                alpha: 0.6,
                duration: 800,
                delay: i * 150 + 600,
                yoyo: true,
                repeat: -1,
                repeatDelay: 1200 + Math.random() * 1000,
            });
            // Draw tiny star
            s.fillStyle(0xffffff, 0.7);
            s.fillCircle(0, 0, 1.5);
            s.fillStyle(0xffffff, 0.3);
            s.fillCircle(0, 0, 3);
        }

        // Gentle bob animation for sparkles
        this.tweens.add({
            targets: sparkles,
            y: '+=4',
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });

        const hideButtons = () => {
            acceptBtn.removeInteractive();
            rejectBtn.removeInteractive();
            sparkles.forEach(s => { this.tweens.killTweensOf(s); s.destroy(); });
            rejectGlow.destroy();
            acceptGlow.destroy();
            this.tweens.add({ targets: [rejectBtn, acceptBtn], alpha: 0, duration: 300 });
        };

        rejectBtn.on('pointerdown', () => {
            hideButtons();

            const npcX = this.npcSprite.x;
            const npcY = this.npcSprite.y;
            const playerX = this.playerSprite.x;
            this.npcSprite.setVisible(false);

            const walkSprite = this.add.sprite(npcX, npcY + 90, 'npc_subway_walk')
                .setScale(0.26)
                .setOrigin(0.5, 1)
                .setDepth(10);

            this.time.delayedCall(600, () => {
                walkSprite.play('npc_subway_walk_anim');
            const npcStepSound = new StepSoundGenerator(320);
            this.tweens.add({
                targets: walkSprite,
                x: CONSTANTS.SCREEN_WIDTH + 100,
                duration: 4000,
                ease: 'Linear',
                onUpdate: () => {
                    npcStepSound.play(0.2);
                    if (walkSprite.x > playerX && this.playerSprite.texture.key === 'player_sit') {
                        this.playerSprite.setTexture('player_subway_stand');
                        this.playerSprite.y += 20;
                    }
                },
                onComplete: () => {
                    // NPC left screen — start snow
                    if (!this.snowStarted) {
                        this.snowStarted = true;
                        this.snow.start();
                    }
                    // Wait 5s of snow, then transition to EndingScene
                    this.time.delayedCall(5000, () => {
                        this.cameras.main.fadeOut(1500, 0, 0, 0);
                        this.cameras.main.once('camerafadeoutcomplete', () => {
                            this.scene.start('EndingScene', { result: 'reject' });
                        });
                    });
                }
            });
            });
        });

        acceptBtn.on('pointerdown', () => {
            hideButtons();
            this.cameras.main.fadeOut(500, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.scene.start('EndingScene', {
                    result: 'accept',
                    temp: this.currentTemp
                });
            });
        });
    }
}
