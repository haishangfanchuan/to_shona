import * as Phaser from 'phaser';

interface EnvelopeConfig {
    letterText: string;
    showRedeemButton: boolean;
    redeemMethod?: string;
    redeemCode?: string;
    envelopeTint?: number;
    onRedeem?: () => void;
    onComplete?: () => void;
}

/**
 * Phaser Graphics implementation that replicates：
 *  - CSS-style envelope with back, front (triangle flap), top flap
 *  - Click to open: flap rotates open (simulated via Graphics redraw)
 *  - Paper flies out in a curl arc (3-phase WAAPI-like tween)
 *  - Envelope fades behind the paper
 *  - Paper expands fullscreen, then typewriter text appears
 *  - Optional redeem button + ticket
 */
export class EnvelopeLetter {
    private scene: Phaser.Scene;
    private config: EnvelopeConfig;

    // Envelope dimensions (matches demo: 300×200)
    private envW = 300;
    private envH = 200;

    // Top-level containers
    private sceneContainer!: Phaser.GameObjects.Container;
    private envelopeContainer!: Phaser.GameObjects.Container;
    private letterContainer!: Phaser.GameObjects.Container;

    // Envelope layers
    private envBack!: Phaser.GameObjects.Graphics;
    private envFront!: Phaser.GameObjects.Graphics;
    private envFlap!: Phaser.GameObjects.Graphics;

    // Paper
    private paperGfx!: Phaser.GameObjects.Graphics;
    private paperText!: Phaser.GameObjects.Text;

    // State
    private clicked = false;
    private dustEvent?: Phaser.Time.TimerEvent;

    constructor(scene: Phaser.Scene, config: EnvelopeConfig) {
        this.scene = scene;
        this.config = config;
    }

    show(x: number, y: number) {
        // Root container at the position passed by the caller
        this.sceneContainer = this.scene.add.container(x, y)
            .setDepth(200);

        // ── Envelope back ──
        this.envBack = this.scene.add.graphics().setDepth(1);
        this.drawEnvBack(this.envBack);

        // ── Paper (hidden initially inside envelope) ──
        const paperW = 280;
        const paperH = 180;
        this.paperGfx = this.scene.add.graphics().setDepth(2);
        this.drawPaper(this.paperGfx, paperW, paperH);

        this.paperText = this.scene.add.text(-paperW / 2 + 40, -paperH / 2 + 30, '', {
            fontSize: '18px',
            color: '#333333',
            fontFamily: 'Georgia, serif',
            lineSpacing: 14,
            wordWrap: { width: paperW - 80 },
        }).setDepth(3).setAlpha(0);

        this.letterContainer = this.scene.add.container(0, 0, [this.paperGfx, this.paperText])
            .setDepth(2);

        // ── Envelope front (triangle flap) ──
        this.envFront = this.scene.add.graphics().setDepth(3);
        this.drawEnvFront(this.envFront);

        // ── Envelope top flap ──
        this.envFlap = this.scene.add.graphics().setDepth(4);
        this.drawEnvFlapClosed(this.envFlap);

        // Envelope container holds everything
        this.envelopeContainer = this.scene.add.container(0, 0, [
            this.envBack,
            this.letterContainer,
            this.envFront,
            this.envFlap,
        ]).setDepth(1);

        this.sceneContainer.add(this.envelopeContainer);

        // ── Red heart seal button on the flap ──
        this.createHeartSeal();

        // Spawn ambient dust
        this.spawnDust();

        // Entrance animation: fade in + scale up
        this.sceneContainer.setAlpha(0).setScale(0.5);
        this.scene.tweens.add({
            targets: this.sceneContainer,
            alpha: 1, scaleX: 1, scaleY: 1,
            duration: 1200,
            ease: 'Back.easeOut',
        });

    }

    destroy() {
        if (this.dustEvent) this.dustEvent.remove();
        if (this.sceneContainer) this.sceneContainer.destroy();
    }

    // ════════════════════════════════════════════
    //  Drawing helpers (CSS border-triangle style)
    // ════════════════════════════════════════════

    /**
     * env-back: #d9d9d9 rounded rect (the back panel)
     */
    private drawEnvBack(g: Phaser.GameObjects.Graphics) {
        const w = this.envW;
        const h = this.envH;
        g.clear();
        g.fillStyle(0xd9d9d9, 1);
        g.fillRoundedRect(-w / 2, -h / 2, w, h, 4);
    }

    /**
     * env-front: bottom triangle (the front flap)
     * CSS: border-left: 150px solid #e2e2e2; border-right: 150px solid #e2e2e2;
     *      border-bottom: 110px solid #ececec; border-top: 90px solid transparent;
     */
    private drawEnvFront(g: Phaser.GameObjects.Graphics) {
        const w = this.envW;
        const h = this.envH;
        g.clear();

        // CSS border-trick: border-left 150px #e2e2e2 = left triangle pointing right
        g.fillStyle(0xe2e2e2, 1);
        g.fillTriangle(-w / 2, -h / 2, -w / 2, h / 2, 0, 0);

        // border-right 150px #e2e2e2 = right triangle pointing left
        g.fillStyle(0xe2e2e2, 1);
        g.fillTriangle(w / 2, -h / 2, w / 2, h / 2, 0, 0);

        // border-bottom 110px #ececec = bottom triangle pointing up
        g.fillStyle(0xececec, 1);
        g.fillTriangle(-w / 2, h / 2, w / 2, h / 2, 0, h / 2 - 110);
    }

    /**
     * env-flap (closed): top triangle pointing down
     * CSS: border-left: 150px solid transparent; border-right: 150px solid transparent;
     *      border-top: 120px solid #cccccc;
     * Creates a downward-pointing triangle at top.
     */
    private drawEnvFlapClosed(g: Phaser.GameObjects.Graphics) {
        const w = this.envW;
        const h = this.envH;
        g.clear();

        g.fillStyle(0xcccccc, 1);
        g.fillTriangle(
            -w / 2, -h / 2,
            w / 2, -h / 2,
            0, -h / 2 + 120
        );
    }

    /**
     * env-flap (open): rotated up (simulated by drawing upward-pointing triangle)
     * CSS: rotateX(180deg) flips the flap upward
     */
    private drawEnvFlapOpen(g: Phaser.GameObjects.Graphics) {
        const w = this.envW;
        const h = this.envH;
        g.clear();

        // Flap opens upward: triangle now points up from top edge
        g.fillStyle(0xcccccc, 1);
        g.fillTriangle(
            -w / 2, -h / 2,
            w / 2, -h / 2,
            0, -h / 2 - 120
        );
    }

    /**
     * Paper: gradient-style white-to-cream with shadow
     * CSS: background: linear-gradient(135deg, #ffffff 0%, #f4f1ea 100%)
     *      border-radius: 2px; box-shadow: 0 0 10px rgba(0,0,0,0.1)
     */
    private drawPaper(g: Phaser.GameObjects.Graphics, paperW: number, paperH: number) {
        g.clear();

        // Shadow
        g.fillStyle(0x000000, 0.1);
        g.fillRoundedRect(-paperW / 2 + 1, -paperH / 2 + 2, paperW, paperH, 2);

        // Main paper body — gradient simulated with two overlapping rects
        g.fillStyle(0xf4f1ea, 1);
        g.fillRoundedRect(-paperW / 2, -paperH / 2, paperW, paperH, 2);
        g.fillStyle(0xffffff, 0.7);
        g.fillRoundedRect(-paperW / 2, -paperH / 2, paperW * 0.7, paperH, 2);
    }

    // ════════════════════════════════════════════
    //  Heart seal button on envelope flap
    // ════════════════════════════════════════════

    private createHeartSeal() {
        const cx = this.sceneContainer.x;
        const cy = this.sceneContainer.y + 20;
        const s = 18;

        const heartGfx = this.scene.add.graphics().setDepth(210);
        this.drawHeart(heartGfx, s);
        heartGfx.setPosition(cx, cy);

        // Use a Zone for reliable hit testing — large enough to tap easily
        const hitSize = s * 3;
        const hitZone = this.scene.add.zone(cx, cy, hitSize, hitSize)
            .setDepth(211).setInteractive({ useHandCursor: true });

        // Pulse animation on the gfx
        this.scene.tweens.add({
            targets: heartGfx,
            scaleX: 1.12, scaleY: 1.12,
            duration: 700, yoyo: true, repeat: -1,
            ease: 'Sine.easeInOut',
        });

        hitZone.on('pointerdown', () => {
            if (this.clicked) return;
            this.clicked = true;
            hitZone.destroy();
            this.scene.tweens.killTweensOf(heartGfx);
            this.scene.tweens.add({
                targets: heartGfx,
                scaleX: 1.6, scaleY: 1.6, alpha: 0,
                duration: 300, ease: 'Cubic.easeOut',
                onComplete: () => {
                    heartGfx.destroy();
                    this.onEnvelopeClick();
                },
            });
        });
    }

    private drawHeart(g: Phaser.GameObjects.Graphics, s: number) {
        // Shadow
        g.fillStyle(0x000000, 0.15);
        g.fillCircle(-s * 0.35 + 1, -s * 0.2 + 2, s * 0.52);
        g.fillCircle(s * 0.35 + 1, -s * 0.2 + 2, s * 0.52);
        g.fillTriangle(-s * 0.88 + 1, -s * 0.15 + 2, s * 0.88 + 1, -s * 0.15 + 2, 1, s * 0.82 + 2);
        // Main heart — soft red
        g.fillStyle(0xd94f5c, 1);
        g.fillCircle(-s * 0.35, -s * 0.2, s * 0.5);
        g.fillCircle(s * 0.35, -s * 0.2, s * 0.5);
        g.fillTriangle(-s * 0.85, -s * 0.15, s * 0.85, -s * 0.15, 0, s * 0.8);
    }

    // ════════════════════════════════════════════
    //  Ambient dust particles
    // ════════════════════════════════════════════

    private spawnDust() {
        const dustGfx = this.scene.add.graphics().setDepth(199);
        this.sceneContainer.add(dustGfx);

        const particles: { x: number; y: number; vx: number; vy: number; phase: number; life: number }[] = [];
        for (let i = 0; i < 12; i++) {
            particles.push({
                x: (Math.random() - 0.5) * this.envW * 1.5,
                y: (Math.random() - 0.5) * this.envH * 2,
                vx: (Math.random() - 0.5) * 0.3,
                vy: -0.1 - Math.random() * 0.2,
                phase: Math.random() * Math.PI * 2,
                life: 0.3 + Math.random() * 0.4,
            });
        }

        this.dustEvent = this.scene.time.addEvent({
            delay: 32,
            loop: true,
            callback: () => {
                dustGfx.clear();
                for (const d of particles) {
                    d.phase += 0.02;
                    d.x += d.vx + Math.sin(d.phase) * 0.15;
                    d.y += d.vy;
                    d.life -= 0.001;
                    if (d.life <= 0) {
                        d.x = (Math.random() - 0.5) * this.envW * 1.5;
                        d.y = this.envH * 0.5;
                        d.life = 0.3 + Math.random() * 0.4;
                    }
                    const alpha = d.life * 0.5;
                    dustGfx.fillStyle(0xf0e0c8, alpha);
                    dustGfx.fillCircle(d.x, d.y, 1.2);
                    dustGfx.fillStyle(0xffffff, alpha * 0.4);
                    dustGfx.fillCircle(d.x, d.y, 0.6);
                }
            },
        });
    }

    // ════════════════════════════════════════════
    //  Click → Open → Fly → Typewriter
    // ════════════════════════════════════════════

    private onEnvelopeClick() {
        // Phase 1: Open flap (simulate rotateX(180deg) by redrawing)
        // We tween the flap container's alpha to 0, redraw as open, fade back in
        this.scene.tweens.add({
            targets: this.envFlap,
            alpha: 0,
            duration: 400,
            ease: 'Quad.easeIn',
            onComplete: () => {
                this.drawEnvFlapOpen(this.envFlap);
                this.scene.tweens.add({
                    targets: this.envFlap,
                    alpha: 1,
                    duration: 400,
                    ease: 'Quad.easeOut',
                    onComplete: () => {
                        this.scene.time.delayedCall(400, () => {
                            this.flyOutPaper();
                        });
                    },
                });
            },
        });
    }

    private flyOutPaper() {
        const W = this.scene.cameras.main.width;
        const H = this.scene.cameras.main.height;

        // Paper starts at envelope center (0,0 within sceneContainer)
        // Target: center of screen, scaled up to fill 80% viewport
        const paperW = 280;
        const paperH = 180;
        const targetScale = Math.min((W * 0.8) / paperW, (H * 0.8) / paperH);

        // Remove paper from envelope container to scene-level for free movement
        this.envelopeContainer.remove(this.letterContainer);
        this.letterContainer.setPosition(0, 0);
        this.letterContainer.setDepth(5);
        this.letterContainer.setAlpha(1);
        this.sceneContainer.add(this.letterContainer);

        // Phase 1: Paper rises out of envelope (ease-out, slight tilt)
        this.scene.tweens.add({
            targets: this.letterContainer,
            y: -180,
            angle: 5,
            scaleX: 0.9,
            scaleY: 0.9,
            duration: 550,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                // Phase 2: Arc flight — up-right with rotation and curl feel
                this.scene.tweens.add({
                    targets: this.letterContainer,
                    x: 160,
                    y: -350,
                    angle: 25,
                    scaleX: 1.1,
                    scaleY: 1.1,
                    duration: 850,
                    ease: 'Sine.easeInOut',
                    onComplete: () => {
                        // Phase 3: Fly to center, flatten out
                        this.scene.tweens.add({
                            targets: this.letterContainer,
                            x: 0,
                            y: 0,
                            angle: 0,
                            scaleX: targetScale,
                            scaleY: targetScale,
                            duration: 900,
                            ease: 'Cubic.easeInOut',
                            onComplete: () => {
                                this.startTypewriter(paperW, paperH);
                            },
                        });
                    },
                });
            },
        });

        // Envelope fades during flight (~1.2s after flight starts)
        this.scene.time.delayedCall(1200, () => {
            this.scene.tweens.add({
                targets: this.envelopeContainer,
                alpha: 0,
                duration: 1500,
                ease: 'Quad.easeOut',
                onComplete: () => {
                    this.envelopeContainer.destroy();
                },
            });
        });
    }

    // ════════════════════════════════════════════
    //  Typewriter effect
    // ════════════════════════════════════════════

    private startTypewriter(paperW: number, paperH: number) {
        // Show text, fade in
        this.paperText.setAlpha(1);

        // Redraw paper at larger size with rounded corners for "fullscreen" look
        // CSS: border-radius: 12px, box-shadow: 0 20px 50px rgba(0,0,0,0.4)
        this.paperGfx.clear();
        this.paperGfx.fillStyle(0x000000, 0.4);
        this.paperGfx.fillRoundedRect(-paperW / 2 + 3, -paperH / 2 + 5, paperW, paperH, 12);
        this.paperGfx.fillStyle(0xf4f1ea, 1);
        this.paperGfx.fillRoundedRect(-paperW / 2, -paperH / 2, paperW, paperH, 12);
        this.paperGfx.fillStyle(0xffffff, 0.6);
        this.paperGfx.fillRoundedRect(-paperW / 2, -paperH / 2, paperW * 0.7, paperH, 12);

        const fullText = this.config.letterText;
        let charIdx = 0;

        const typewriter = this.scene.time.addEvent({
            delay: 80,
            callback: () => {
                charIdx++;
                this.paperText.setText(fullText.substring(0, charIdx));
                if (charIdx >= fullText.length) {
                    typewriter.remove();
                    this.onTextComplete(paperW, paperH);
                }
            },
            loop: true,
        });
    }

    // ════════════════════════════════════════════
    //  After text → Redeem button or complete
    // ════════════════════════════════════════════

    private onTextComplete(paperW: number, paperH: number) {
        if (this.config.showRedeemButton) {
            this.scene.time.delayedCall(500, () => {
                this.showRedeemButton(paperW, paperH);
            });
        } else {
            this.config.onComplete?.();
        }
    }

    private showRedeemButton(paperW: number, paperH: number) {
        const btnW = 120;
        const btnH = 36;
        const btnX = paperW / 2 - btnW / 2 - 10;
        const btnY = paperH / 2 - btnH / 2 - 8;

        const btnBg = this.scene.add.graphics();
        btnBg.fillStyle(0xc49a60, 1);
        btnBg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 8);
        btnBg.fillStyle(0xd4aa70, 0.4);
        btnBg.fillRect(-btnW / 2 + 2, -btnH / 2 + 2, btnW - 4, btnH / 2 - 2);
        btnBg.lineStyle(1, 0xa88040, 0.6);
        btnBg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 8);

        const btnLabel = this.scene.add.text(0, 0, '领取礼物', {
            fontSize: '14px', color: '#ffffff', fontFamily: 'serif',
        }).setOrigin(0.5);

        const btn = this.scene.add.container(btnX, btnY, [btnBg, btnLabel])
            .setSize(btnW, btnH).setAlpha(0).setScale(0.8);

        // Glow
        const glow = this.scene.add.graphics();
        glow.fillStyle(0xc49a60, 0.12);
        glow.fillRoundedRect(-btnW / 2 - 6, -btnH / 2 - 6, btnW + 12, btnH + 12, 12);
        glow.setPosition(btnX, btnY).setAlpha(0);

        this.letterContainer.add([btn, glow]);

        this.scene.tweens.add({
            targets: btn,
            alpha: 1, scaleX: 1, scaleY: 1,
            duration: 400, ease: 'Back.easeOut',
        });
        this.scene.tweens.add({
            targets: glow,
            alpha: 0.7,
            duration: 900, yoyo: true, repeat: -1,
        });

        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => {
            this.scene.tweens.add({ targets: btn, scaleX: 1.08, scaleY: 1.08, duration: 120 });
            btnBg.clear();
            btnBg.fillStyle(0xd4aa70, 1);
            btnBg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 8);
            btnBg.fillStyle(0xe0b880, 0.4);
            btnBg.fillRect(-btnW / 2 + 2, -btnH / 2 + 2, btnW - 4, btnH / 2 - 2);
            btnBg.lineStyle(1, 0xb89050, 0.6);
            btnBg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 8);
        });
        btn.on('pointerout', () => {
            this.scene.tweens.add({ targets: btn, scaleX: 1, scaleY: 1, duration: 120 });
            btnBg.clear();
            btnBg.fillStyle(0xc49a60, 1);
            btnBg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 8);
            btnBg.fillStyle(0xd4aa70, 0.4);
            btnBg.fillRect(-btnW / 2 + 2, -btnH / 2 + 2, btnW - 4, btnH / 2 - 2);
            btnBg.lineStyle(1, 0xa88040, 0.6);
            btnBg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 8);
        });
        btn.on('pointerdown', () => {
            btn.removeInteractive();
            this.scene.tweens.killTweensOf(glow);
            glow.destroy();
            this.config.onRedeem?.();
            this.scene.tweens.add({
                targets: this.letterContainer,
                alpha: 0, scaleX: 0.3, scaleY: 0.3,
                duration: 600, ease: 'Cubic.easeIn',
                onComplete: () => {
                    this.letterContainer.destroy();
                    this.showTicket();
                },
            });
        });
    }

    // ════════════════════════════════════════════
    //  Ticket (redeem result)
    // ════════════════════════════════════════════

    private showTicket() {
        const W = this.scene.cameras.main.width;
        const H = this.scene.cameras.main.height;
        const ticketW = 270;
        const ticketH = 190;

        const ticketGfx = this.scene.add.graphics();
        ticketGfx.fillStyle(0x000000, 0.1);
        ticketGfx.fillRoundedRect(-ticketW / 2 + 3, -ticketH / 2 + 4, ticketW, ticketH, 8);
        ticketGfx.fillStyle(0xfff8ee, 1);
        ticketGfx.fillRoundedRect(-ticketW / 2, -ticketH / 2, ticketW, ticketH, 8);
        ticketGfx.fillStyle(0xf5ece0, 0.4);
        ticketGfx.fillRect(-ticketW / 2 + 4, ticketH / 2 - 14, ticketW - 8, 10);
        ticketGfx.lineStyle(2, 0xc49a60, 0.7);
        ticketGfx.strokeRoundedRect(-ticketW / 2 + 4, -ticketH / 2 + 4, ticketW - 8, ticketH - 8, 6);
        ticketGfx.lineStyle(0.5, 0xd4b888, 0.4);
        ticketGfx.strokeRoundedRect(-ticketW / 2 + 8, -ticketH / 2 + 8, ticketW - 16, ticketH - 16, 4);
        ticketGfx.lineStyle(1, 0xc49a60, 0.25);
        for (let x = -ticketW / 2 + 18; x < ticketW / 2 - 18; x += 8) {
            ticketGfx.lineBetween(x, 22, x + 4, 22);
        }

        const corners = [
            [-ticketW / 2 + 18, -ticketH / 2 + 18],
            [ticketW / 2 - 18, -ticketH / 2 + 18],
            [-ticketW / 2 + 18, ticketH / 2 - 18],
            [ticketW / 2 - 18, ticketH / 2 - 18],
        ];
        ticketGfx.fillStyle(0xc49a60, 0.35);
        for (const [cx, cy] of corners) {
            ticketGfx.fillTriangle(cx, cy - 4, cx + 4, cy, cx, cy + 4);
            ticketGfx.fillTriangle(cx, cy - 4, cx - 4, cy, cx, cy + 4);
        }

        const ticketTitle = this.scene.add.text(0, -ticketH / 2 + 26, '兑 奖 券', {
            fontSize: '18px', color: '#8a6a3a', fontFamily: 'serif',
        }).setOrigin(0.5);

        const star = this.scene.add.text(0, -ticketH / 2 + 50, '✦', {
            fontSize: '10px', color: '#c49a60',
        }).setOrigin(0.5);

        const methodLabel = this.scene.add.text(-ticketW / 2 + 28, -8, '领取方式', {
            fontSize: '11px', color: '#a08a6a', fontFamily: 'serif',
        });
        const methodValue = this.scene.add.text(-ticketW / 2 + 28, 10, this.config.redeemMethod || '', {
            fontSize: '14px', color: '#5a4a3a', fontFamily: 'serif',
        });

        const codeLabel = this.scene.add.text(-ticketW / 2 + 28, 28, '兑换码', {
            fontSize: '11px', color: '#a08a6a', fontFamily: 'serif',
        });
        const codeValue = this.scene.add.text(-ticketW / 2 + 28, 46, this.config.redeemCode || '', {
            fontSize: '14px', color: '#5a4a3a', fontFamily: 'serif',
        });

        const expiryLabel = this.scene.add.text(-ticketW / 2 + 28, 58, '有效时间', {
            fontSize: '11px', color: '#a08a6a', fontFamily: 'serif',
        });
        const expiryValue = this.scene.add.text(-ticketW / 2 + 28, 76, '永 久 有 效', {
            fontSize: '14px', color: '#8a3a3a', fontFamily: 'serif',
        });

        // Seal stamp
        const seal = this.scene.add.graphics();
        seal.fillStyle(0xcc4444, 0.25);
        seal.fillCircle(0, 0, 20);
        seal.lineStyle(1.5, 0xcc4444, 0.55);
        seal.strokeCircle(0, 0, 20);
        seal.lineStyle(1, 0xcc4444, 0.4);
        seal.strokeCircle(0, 0, 15);
        seal.fillStyle(0xcc4444, 0.15);
        seal.fillCircle(0, 0, 12);

        const sealContainer = this.scene.add.container(ticketW / 2 - 40, ticketH / 2 - 40, [seal])
            .setAngle(-15);

        const ticketContainer = this.scene.add.container(W / 2, H / 2, [
            ticketGfx, ticketTitle, star, methodLabel, methodValue,
            codeLabel, codeValue,
            expiryLabel, expiryValue, sealContainer,
        ]).setDepth(210).setAlpha(0).setScale(0.2);

        this.scene.tweens.add({
            targets: ticketContainer,
            alpha: 1, scaleX: 1, scaleY: 1,
            duration: 800, ease: 'Back.easeOut',
        });

        // Sparkle burst
        const sparkleGfx = this.scene.add.graphics().setDepth(209);
        const sparkles: { x: number; y: number; vx: number; vy: number; life: number; size: number }[] = [];
        for (let i = 0; i < 14; i++) {
            const angle = (i / 14) * Math.PI * 2;
            sparkles.push({
                x: W / 2, y: H / 2,
                vx: Math.cos(angle) * (1.5 + Math.random() * 2.5),
                vy: Math.sin(angle) * (1.5 + Math.random() * 2.5),
                life: 1,
                size: 1 + Math.random() * 2.5,
            });
        }

        const sparkleUpdate = this.scene.time.addEvent({
            delay: 16,
            loop: true,
            callback: () => {
                sparkleGfx.clear();
                let allDead = true;
                for (const s of sparkles) {
                    s.x += s.vx;
                    s.y += s.vy;
                    s.vy += 0.02;
                    s.life -= 0.012;
                    if (s.life <= 0) continue;
                    allDead = false;
                    sparkleGfx.fillStyle(0xffd4a0, s.life * 0.8);
                    sparkleGfx.fillCircle(s.x, s.y, s.size * s.life);
                    sparkleGfx.fillStyle(0xffffff, s.life * 0.4);
                    sparkleGfx.fillCircle(s.x, s.y, s.size * s.life * 0.3);
                }
                if (allDead) {
                    sparkleUpdate.remove();
                    sparkleGfx.destroy();
                }
            },
        });

        this.scene.tweens.add({
            targets: sealContainer,
            scaleX: 1.5, scaleY: 1.5,
            duration: 150, delay: 600,
            yoyo: true, ease: 'Quad.easeOut',
        });

        this.config.onComplete?.();
    }
}
