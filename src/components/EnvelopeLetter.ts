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

export class EnvelopeLetter {
    private scene: Phaser.Scene;
    private config: EnvelopeConfig;

    private envW = 300;
    private envH = 200;
    private paperW = 340;
    private paperH = 480;

    private sceneContainer!: Phaser.GameObjects.Container;
    private envelopeContainer!: Phaser.GameObjects.Container;

    private envBack!: Phaser.GameObjects.Graphics;
    private envFront!: Phaser.GameObjects.Graphics;
    private envFlap!: Phaser.GameObjects.Graphics;

    // DOM-based paper
    private paperEl!: HTMLDivElement;
    private scrollContainerEl!: HTMLDivElement;
    private textEl!: HTMLDivElement;
    private redeemBtnEl!: HTMLDivElement | null;
    private paperVisible = false;

    private clicked = false;
    private dustEvent?: Phaser.Time.TimerEvent;

    constructor(scene: Phaser.Scene, config: EnvelopeConfig) {
        this.scene = scene;
        this.config = config;
        this.redeemBtnEl = null;
    }

    show(x: number, y: number) {
        this.sceneContainer = this.scene.add.container(x, y)
            .setDepth(200);

        // Envelope back
        this.envBack = this.scene.add.graphics().setDepth(1);
        this.drawEnvBack(this.envBack);

        // Envelope front
        this.envFront = this.scene.add.graphics().setDepth(3);
        this.drawEnvFront(this.envFront);

        // Envelope top flap
        this.envFlap = this.scene.add.graphics().setDepth(4);
        this.drawEnvFlapClosed(this.envFlap);

        this.envelopeContainer = this.scene.add.container(0, 0, [
            this.envBack, this.envFront, this.envFlap,
        ]).setDepth(1);

        this.sceneContainer.add(this.envelopeContainer);

        // Create DOM paper (hidden initially)
        this.createDomPaper();

        // Heart seal
        this.createHeartSeal();

        // Dust
        this.spawnDust();

        // Entrance animation
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
        if (this.paperEl) this.paperEl.remove();
        if (this.scrollContainerEl) this.scrollContainerEl.remove();
        if (this.redeemBtnEl) this.redeemBtnEl.remove();
        if (this.sceneContainer) this.sceneContainer.destroy();
    }

    // ════════════════════════════════════════════
    //  DOM Paper
    // ════════════════════════════════════════════

    private createDomPaper() {
        const W = this.scene.cameras.main.width;
        const H = this.scene.cameras.main.height;
        const canvas = this.scene.game.canvas;
        const canvasRect = canvas.getBoundingClientRect();
        const scaleX = canvasRect.width / W;
        const scaleY = canvasRect.height / H;

        // Responsive paper size for mobile
        const isMobile = Math.min(W, H) < 500;
        const paperScale = isMobile ? 0.95 : 0.9;
        const maxPaperWidth = isMobile ? Math.min(W * 0.9, 400) : this.paperW;
        const maxPaperHeight = isMobile ? Math.min(H * 0.75, 600) : this.paperH;

        const pw = Math.min(this.paperW * paperScale, maxPaperWidth);
        const ph = Math.min(this.paperH * paperScale, maxPaperHeight);
        const px = (W - pw) / 2;
        const py = (H - ph) / 2;

        const pxScreen = px * scaleX;
        const pyScreen = py * scaleY;
        const pwScreen = pw * scaleX;
        const phScreen = ph * scaleY;
        const paddingX = (isMobile ? 16 : 24) * scaleX;
        const paddingY = (isMobile ? 14 : 18) * scaleY;

        this.paperEl = document.createElement('div');
        this.paperEl.style.cssText = `
            position:absolute;
            pointer-events:none;
            z-index:100;
            left:${canvasRect.left + pxScreen}px;
            top:${canvasRect.top + pyScreen}px;
            width:${pwScreen}px;
            height:${phScreen}px;
            background:#faf7f0;
            border-radius:12px;
            box-shadow:0 2px 12px rgba(0,0,0,0.15);
            padding:${paddingY}px ${paddingX}px;
            box-sizing:border-box;
            opacity:0;
            transition:opacity 0.8s ease;
        `;

        this.scrollContainerEl = document.createElement('div');
        this.scrollContainerEl.style.cssText = `
            width:100%;
            height:100%;
            overflow-y:auto;
            overflow-x:hidden;
            padding-right:${8 * scaleX}px;
            margin-right:${-8 * scaleX}px;
            box-sizing:content-box;
        `;
        this.scrollContainerEl.className = 'envelope-scroll';

        this.textEl = document.createElement('div');
        const fontSize = isMobile ? 13 : 14;
        this.textEl.style.cssText = `
            font-size:${fontSize * scaleY}px;
            color:#333;
            font-family:Georgia,serif;
            line-height:1.8;
            white-space:pre-wrap;
            word-wrap:break-word;
            -webkit-text-size-adjust:100%;
            text-size-adjust:100%;
        `;

        this.scrollContainerEl.appendChild(this.textEl);
        this.paperEl.appendChild(this.scrollContainerEl);
        document.body.appendChild(this.paperEl);

        this.addScrollbarStyle();
    }

    private addScrollbarStyle() {
        const styleId = 'envelope-scrollbar-style';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .envelope-scroll {
                -webkit-overflow-scrolling: touch;
                scroll-behavior: smooth;
            }
            .envelope-scroll::-webkit-scrollbar {
                width: 6px;
            }
            .envelope-scroll::-webkit-scrollbar-track {
                background: rgba(0,0,0,0.05);
                border-radius: 3px;
            }
            .envelope-scroll::-webkit-scrollbar-thumb {
                background: rgba(196,154,96,0.5);
                border-radius: 3px;
            }
            .envelope-scroll::-webkit-scrollbar-thumb:hover {
                background: rgba(196,154,96,0.7);
            }
        `;
        document.head.appendChild(style);
    }

    // ════════════════════════════════════════════
    //  Drawing helpers
    // ════════════════════════════════════════════

    private drawEnvBack(g: Phaser.GameObjects.Graphics) {
        const w = this.envW;
        const h = this.envH;
        g.clear();
        g.fillStyle(0xd9d9d9, 1);
        g.fillRoundedRect(-w / 2, -h / 2, w, h, 4);
    }

    private drawEnvFront(g: Phaser.GameObjects.Graphics) {
        const w = this.envW;
        const h = this.envH;
        g.clear();
        g.fillStyle(0xe2e2e2, 1);
        g.fillTriangle(-w / 2, -h / 2, -w / 2, h / 2, 0, 0);
        g.fillStyle(0xe2e2e2, 1);
        g.fillTriangle(w / 2, -h / 2, w / 2, h / 2, 0, 0);
        g.fillStyle(0xececec, 1);
        g.fillTriangle(-w / 2, h / 2, w / 2, h / 2, 0, h / 2 - 110);
    }

    private drawEnvFlapClosed(g: Phaser.GameObjects.Graphics) {
        const w = this.envW;
        const h = this.envH;
        g.clear();
        g.fillStyle(0xcccccc, 1);
        g.fillTriangle(-w / 2, -h / 2, w / 2, -h / 2, 0, -h / 2 + 120);
    }

    private drawEnvFlapOpen(g: Phaser.GameObjects.Graphics) {
        const w = this.envW;
        const h = this.envH;
        g.clear();
        g.fillStyle(0xcccccc, 1);
        g.fillTriangle(-w / 2, -h / 2, w / 2, -h / 2, 0, -h / 2 - 120);
    }

    // ════════════════════════════════════════════
    //  Heart seal
    // ════════════════════════════════════════════

    private createHeartSeal() {
        const cx = this.sceneContainer.x;
        const cy = this.sceneContainer.y + 20;
        const s = 18;

        const heartGfx = this.scene.add.graphics().setDepth(210);
        this.drawHeart(heartGfx, s);
        heartGfx.setPosition(cx, cy);

        const hitSize = s * 3;
        const hitZone = this.scene.add.zone(cx, cy, hitSize, hitSize)
            .setDepth(211).setInteractive({ useHandCursor: true });

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
        g.fillStyle(0x000000, 0.15);
        g.fillCircle(-s * 0.35 + 1, -s * 0.2 + 2, s * 0.52);
        g.fillCircle(s * 0.35 + 1, -s * 0.2 + 2, s * 0.52);
        g.fillTriangle(-s * 0.88 + 1, -s * 0.15 + 2, s * 0.88 + 1, -s * 0.15 + 2, 1, s * 0.82 + 2);
        g.fillStyle(0xd94f5c, 1);
        g.fillCircle(-s * 0.35, -s * 0.2, s * 0.5);
        g.fillCircle(s * 0.35, -s * 0.2, s * 0.5);
        g.fillTriangle(-s * 0.85, -s * 0.15, s * 0.85, -s * 0.15, 0, s * 0.8);
    }

    // ════════════════════════════════════════════
    //  Ambient dust
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
                if (this.paperVisible) return;
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
    //  Click → Open → Fade in paper → Typewriter
    // ════════════════════════════════════════════

    private onEnvelopeClick() {
        // Open flap
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
                        this.scene.time.delayedCall(300, () => {
                            this.showPaper();
                        });
                    },
                });
            },
        });
    }

    private showPaper() {
        this.paperVisible = true;

        // Fade out envelope
        this.scene.tweens.add({
            targets: this.envelopeContainer,
            alpha: 0,
            duration: 800,
            ease: 'Quad.easeOut',
            onComplete: () => {
                this.envelopeContainer.destroy();
            },
        });

        // Fade in DOM paper
        this.paperEl.style.opacity = '1';
        this.paperEl.style.pointerEvents = 'auto';

        // Start typewriter after paper fades in
        this.scene.time.delayedCall(800, () => {
            this.startTypewriter();
        });
    }

    // ════════════════════════════════════════════
    //  Typewriter (DOM-based)
    // ════════════════════════════════════════════

    private startTypewriter() {
        const fullText = this.config.letterText;
        let charIdx = 0;

        const typewriter = this.scene.time.addEvent({
            delay: 50,
            callback: () => {
                charIdx++;
                this.textEl.textContent = fullText.substring(0, charIdx);

                // Auto-scroll to bottom during typing
                if (this.scrollContainerEl) {
                    this.scrollContainerEl.scrollTop = this.scrollContainerEl.scrollHeight;
                }

                if (charIdx >= fullText.length) {
                    typewriter.remove();
                    // Scroll back to top when done
                    if (this.scrollContainerEl) {
                        this.scrollContainerEl.scrollTop = 0;
                    }
                    this.onTextComplete();
                }
            },
            loop: true,
        });
    }

    // ════════════════════════════════════════════
    //  After text → Redeem button or complete
    // ════════════════════════════════════════════

    private onTextComplete() {
        if (this.config.showRedeemButton) {
            this.scene.time.delayedCall(500, () => {
                this.showRedeemButton();
            });
        } else {
            this.config.onComplete?.();
        }
    }

    private showRedeemButton() {

        const paperRect = this.paperEl.getBoundingClientRect();
        const btnW = 120;
        const btnH = 36;

        const btnEl = document.createElement('div');
        btnEl.style.cssText = `
            position:absolute;
            z-index:101;
            left:${paperRect.left + (paperRect.width - btnW) / 2}px;
            top:${paperRect.bottom + 10}px;
            width:${btnW}px;
            height:${btnH}px;
            background:#c49a60;
            border-radius:8px;
            display:flex;
            align-items:center;
            justify-content:center;
            cursor:pointer;
            opacity:0;
            transform:scale(0.8);
            transition:opacity 0.4s ease, transform 0.4s ease, background 0.15s;
            box-shadow:0 2px 8px rgba(196,154,96,0.3);
        `;

        const label = document.createElement('span');
        label.textContent = '领取礼物';
        label.style.cssText = 'font-size:14px;color:#fff;font-family:serif;user-select:none;';
        btnEl.appendChild(label);
        document.body.appendChild(btnEl);
        this.redeemBtnEl = btnEl;

        // Animate in
        requestAnimationFrame(() => {
            btnEl.style.opacity = '1';
            btnEl.style.transform = 'scale(1)';
        });

        btnEl.addEventListener('mouseover', () => {
            btnEl.style.background = '#d4aa70';
            btnEl.style.transform = 'scale(1.08)';
        });
        btnEl.addEventListener('mouseout', () => {
            btnEl.style.background = '#c49a60';
            btnEl.style.transform = 'scale(1)';
        });
        btnEl.addEventListener('click', () => {
            btnEl.style.pointerEvents = 'none';
            this.config.onRedeem?.();

            // Fade out paper + button
            this.paperEl.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            this.paperEl.style.opacity = '0';
            this.paperEl.style.transform = 'scale(0.3)';
            btnEl.style.transition = 'opacity 0.6s ease';
            btnEl.style.opacity = '0';

            this.scene.time.delayedCall(700, () => {
                if (this.redeemBtnEl) { this.redeemBtnEl.remove(); this.redeemBtnEl = null; }
                this.paperEl.style.display = 'none';
                this.showTicket();
            });
        });
    }

    // ════════════════════════════════════════════
    //  Ticket (redeem result) — still Canvas-based
    // ════════════════════════════════════════════

    private showTicket() {
        const W = this.scene.cameras.main.width;
        const H = this.scene.cameras.main.height;
        const ticketW = 340;
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

        const methodLine = this.scene.add.text(-ticketW / 2 + 28, -38, '领取方式：' + (this.config.redeemMethod || ''), {
            fontSize: '12px', color: '#4a3a2a', fontFamily: 'serif',
        });

        const codeLine = this.scene.add.text(-ticketW / 2 + 28, -14, '兑换码：' + (this.config.redeemCode || ''), {
            fontSize: '12px', color: '#4a3a2a', fontFamily: 'serif',
        });

        const expiryLine = this.scene.add.text(-ticketW / 2 + 28, 10, '有效时间：永 久 有 效', {
            fontSize: '12px', color: '#7a2a2a', fontFamily: 'serif',
        });

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
            ticketGfx, ticketTitle, star,
            methodLine, codeLine, expiryLine,
            sealContainer,
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
