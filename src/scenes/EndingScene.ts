import * as Phaser from 'phaser';
import { CONSTANTS } from '../config/constants';
import { DIALOGUES } from '../config/dialogues';
import { EnvelopeLetter } from '../components/EnvelopeLetter';

// ─── Parameters ───
const PARAMS = {
    ROPE_COUNT: 45,
    GRAVITY: 0.25,
    DAMPING: 0.985,
    CONSTRAINT_ITERATIONS: 4,
    BUTTERFLY_SPEED: 0.1875,
    PETAL_FALL_CHANCE: 0.0008,
    PIXEL_SIZE: 3,
    SPRITE_SCALE: 2,    // render at higher res then display small
};

// HE palette: 0=transparent, 1=pink, 2=dark pink, 3=green, 4=dark green, 5=white, 6=blue, 7=orange, 8=black
const PALETTE: Record<string, number> = {
    '1': 0xffb7c5, '2': 0xe8789a, '3': 0x7ec850, '4': 0x4a8c2a,
    '5': 0xffffff, '6': 0x6eb5ff, '7': 0xffa54f, '8': 0x2a2a3e,
    '9': 0xc490ff, 'a': 0xffda6b, 'b': 0xff6b8a, 'c': 0xffd4e8,
    'd': 0x9b6dff, 'e': 0xffe89a,
};

// BE palette: withered brown/dark ochre/gray-brown tones
const PALETTE_BE: Record<string, number> = {
    '1': 0xa08060, '2': 0x7a5a3a, '3': 0x8a7a58, '4': 0x5a4a30,
    '5': 0x908880, '6': 0x7a6b5d, '7': 0x5c4033, '8': 0x3a3530,
    '9': 0x807060, 'a': 0x9a8460, 'b': 0x6a5038, 'c': 0x8a7a5a,
    'd': 0x584030, 'e': 0x706050,
};

const SPRITE_FLOWER = [
    '01010', '1c1c1', 'c121c', '1c1c1', '01010',
];
const SPRITE_FLOWER_2 = [
    '00b00', '0b1b0', 'b121b', '0b1b0', '00b00',
];
const SPRITE_LEAF = [
    '00340', '03430', '34340', '34430', '03400',
];
const SPRITE_PETAL = [
    '010', '121', '010',
];

// BE: wilted flower (drooping petals, brown/ochre)
const SPRITE_DEAD_FLOWER = [
    '01010', 'a2a2a', 'a121a', 'a2a2a', '06060',
];
const SPRITE_DEAD_FLOWER_2 = [
    '00b00', '0b1b0', 'b161b', '06060', '00600',
];
// BE: dried curled leaf
const SPRITE_DEAD_LEAF = [
    '00340', '03430', '3b340', '3b430', '06400',
];
// BE: small debris fragment
const SPRITE_DEBRIS = [
    '06', '60',
];

const BE_PARAMS = {
    ROPE_COLOR: 0x7a6b5d,
    BG_WARM_GRAY: '#8a8680',
    BG_COLD_GRAY: '#3a3a3f',
    BG_FINAL: '#1a1a1e',
    LEAF_FALL_CHANCE: 0.0004,
    WIND_WAVE_SPEED: 0.002,
    DEBRIS_COUNT: 6,
};

// ─── Data types ───
interface VNode {
    x: number; y: number; oldX: number; oldY: number;
    pinned: boolean; isGrabbed: boolean;
    decorator: 'flower' | 'leaf' | '';
    texKey: string;
    spriteSize: number;
    img: Phaser.GameObjects.Image | null;
    brokenAbove?: boolean;
}

interface VRope {
    nodes: VNode[];
    spacing: number;
}

interface Petal {
    x: number; y: number; vx: number; vy: number;
    rotation: number; rotSpeed: number; life: number;
    swayPhase: number; size: number;
    img: Phaser.GameObjects.Image;
}

interface Butterfly {
    x: number; y: number; active: boolean; targetX: number;
    baseY: number; phase: number; wingPhase: number; done: boolean;
    text: Phaser.GameObjects.Text;
}

interface BEDebris {
    x: number; y: number; vx: number; vy: number;
    rotation: number; rotSpeed: number; life: number;
    color: number; size: number;
    img: Phaser.GameObjects.Image;
}

type BEPhase = 'idle' | 'wind' | 'collapse' | 'done';

export class EndingScene extends Phaser.Scene {
    private ropes: VRope[] = [];
    private petals: Petal[] = [];
    private butterflies: Butterfly[] = [];
    private nodeCount = 0;
    private time0 = 0;
    private canvas!: Phaser.GameObjects.Graphics;
    private hint!: Phaser.GameObjects.Text;
    private envelopeShown = false;
    private envelope: EnvelopeLetter | null = null;
    private active = false;

    // BE state
    private beActive = false;
    private bePhase: BEPhase = 'idle';
    private beDebris: BEDebris[] = [];
    private beLeaves: Petal[] = [];


    constructor() { super({ key: 'EndingScene' }); }

    create(data: { result: string; temp?: number }) {
        this.input.enabled = false;
        if (data.result === 'reject') {
            this.playBadEnding();
        } else {
            this.sound.stopAll();
            const happyBgm = this.sound.add('bgm_happy', { loop: true, volume: 0.5 });
            happyBgm.play();
            this.playHappyEnding();
        }
    }

    // ── Bad Ending ──
    private beWiltProgress = 0;
    private beTotalDecorators = 0;

    private playBadEnding() {
        this.beActive = true;
        this.bePhase = 'idle';
        this.beDebris = [];
        this.beLeaves = [];
        this.beWiltProgress = 0;
        const W = CONSTANTS.SCREEN_WIDTH;
        const H = CONSTANTS.SCREEN_HEIGHT;

        this.input.enabled = true;

        this.cameras.main.fadeIn(1000, 0, 0, 0);
        this.cameras.main.setBackgroundColor('#f5f0eb');

        // Generate HE textures (fresh) + BE textures (withered)
        const ps = PARAMS.PIXEL_SIZE;
        this.genTexSmooth('__fc_flower1', SPRITE_FLOWER, ps);
        this.genTexSmooth('__fc_flower2', SPRITE_FLOWER_2, ps);
        this.genTexSmooth('__fc_leaf', SPRITE_LEAF, ps);
        this.genTexSmoothBE('__be_dead_flower1', SPRITE_DEAD_FLOWER, ps);
        this.genTexSmoothBE('__be_dead_flower2', SPRITE_DEAD_FLOWER_2, ps);
        this.genTexSmoothBE('__be_dead_leaf', SPRITE_DEAD_LEAF, ps);
        this.genTexSmoothBE('__be_petal_dead_f', SPRITE_PETAL, ps);
        this.genTexSmoothBE('__be_petal_dead_l', SPRITE_DEAD_LEAF, ps);
        this.genTexSmoothBE('__be_debris', SPRITE_DEBRIS, ps);

        // Canvas for pixel-line ropes
        this.canvas = this.add.graphics().setDepth(5);

        // Start with fresh HE flowers
        this.ropes = [];
        const spacingX = W / (PARAMS.ROPE_COUNT + 1);
        this.nodeCount = Math.max(20, Math.ceil(H / 18));
        for (let i = 0; i < PARAMS.ROPE_COUNT; i++) {
            const rope = this.createRope((i + 1) * spacingX, H, this.nodeCount);
            this.ropes.push(rope);
        }

        // Count total decorators for auto-wind trigger
        this.beTotalDecorators = 0;
        for (const rope of this.ropes) {
            for (const n of rope.nodes) {
                if (n.decorator) this.beTotalDecorators++;
            }
        }

        // Background transition: HE warm cream → BE cold gray over entire wilt duration
        this.tweens.addCounter({
            from: 0, to: 1, duration: 15000,
            onUpdate: (tween) => {
                if (this.bePhase === 'collapse' || this.bePhase === 'done') return;
                const v = tween.getValue()!;
                // HE #f5f0eb → BE warm #8a8680 → BE cold #3a3a3f
                const mid = 0.6;
                let cr: number, cg: number, cb: number;
                if (v < mid) {
                    const t = v / mid;
                    cr = Math.floor(0xf5 + (0x8a - 0xf5) * t);
                    cg = Math.floor(0xf0 + (0x86 - 0xf0) * t);
                    cb = Math.floor(0xeb + (0x80 - 0xeb) * t);
                } else {
                    const t = (v - mid) / (1 - mid);
                    cr = Math.floor(0x8a + (0x3a - 0x8a) * t);
                    cg = Math.floor(0x86 + (0x3a - 0x86) * t);
                    cb = Math.floor(0x80 + (0x3f - 0x80) * t);
                }
                this.cameras.main.setBackgroundColor(`rgb(${cr},${cg},${cb})`);
            },
        });
    }

    private genTexSmoothBE(key: string, sprite: string[], pixelSize: number) {
        if (this.textures.exists(key)) this.textures.remove(key);
        const scale = PARAMS.SPRITE_SCALE;
        const rows = sprite.length;
        const cols = sprite[0].length;
        const rw = cols * pixelSize * scale;
        const rh = rows * pixelSize * scale;
        const canvas = document.createElement('canvas');
        canvas.width = rw;
        canvas.height = rh;
        const ctx = canvas.getContext('2d')!;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const ch = sprite[r][c];
                if (ch === '0') continue;
                const hex = PALETTE_BE[ch];
                if (!hex) continue;
                const rr = (hex >> 16) & 0xff;
                const gg = (hex >> 8) & 0xff;
                const bb = hex & 0xff;

                const cx = (c + 0.5) * pixelSize * scale;
                const cy = (r + 0.5) * pixelSize * scale;
                const radius = pixelSize * scale * 0.55;

                const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.3);
                grad.addColorStop(0, `rgba(${rr},${gg},${bb},0.95)`);
                grad.addColorStop(0.6, `rgba(${rr},${gg},${bb},0.7)`);
                grad.addColorStop(1, `rgba(${rr},${gg},${bb},0)`);
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(cx, cy, radius * 1.3, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = `rgb(${rr},${gg},${bb})`;
                ctx.beginPath();
                ctx.arc(cx, cy, radius * 0.75, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        const imgData = ctx.getImageData(0, 0, rw, rh);
        const blurred = this.simpleBlur(imgData, 1);
        ctx.putImageData(blurred, 0, 0);

        this.textures.addCanvas(key, canvas);
    }

    private triggerWindGust() {
        if (this.bePhase !== 'idle') return;
        this.bePhase = 'wind';
    }

    private triggerRopeCollapse() {
        // Erode all ropes simultaneously from bottom nodes upward.
        const stepInterval = 180; // ms between each row being removed (slower)
        let currentIdx = this.nodeCount - 1; // start from bottom node

        const erodeStep = () => {
            if (currentIdx <= 0) {
                // All nodes gone — finish
                this.time.delayedCall(1000, () => {
                    this.bePhase = 'done';
                    this.time.delayedCall(1000, () => {
                        this.showEnvelope('be');
                    });
                });
                return;
            }

            for (const rope of this.ropes) {
                const node = rope.nodes[currentIdx];
                // Remove decorator
                if (node.decorator) {
                    this.spawnBEDeadLeaf(node.x, node.y, node.decorator);
                    node.decorator = '';
                    if (node.img) { node.img.destroy(); node.img = null; }
                }
                // Break the constraint between this node and the one above
                node.brokenAbove = true;

                // Unpin top when only top node remains
                if (currentIdx <= 1) {
                    rope.nodes[0].pinned = false;
                }
            }

            // Spawn debris at this row (every other row for fewer particles)
            if (currentIdx % 2 === 0) {
                const midRope = this.ropes[Math.floor(this.ropes.length / 2)];
                if (midRope) {
                    this.spawnBEDebrisBurst(midRope.nodes[currentIdx].x, midRope.nodes[currentIdx].y);
                }
            }

            currentIdx--;
            this.time.delayedCall(stepInterval, erodeStep);
        };

        erodeStep();
    }

    // ── Envelope → Letter → Redemption Ticket ──
    private showEnvelope(type: 'he' | 'be' = 'he') {
        const W = CONSTANTS.SCREEN_WIDTH;
        const H = CONSTANTS.SCREEN_HEIGHT;

        const isHE = type === 'he';
        this.envelope = new EnvelopeLetter(this, {
            letterText: isHE ? DIALOGUES.ENDING_A_LETTER : DIALOGUES.ENDING_B_LETTER,
            showRedeemButton: true,
            redeemMethod: isHE ? DIALOGUES.ENDING_A_REDEEM_METHOD : DIALOGUES.ENDING_B_REDEEM_METHOD,
            redeemCode: isHE ? DIALOGUES.ENDING_A_REDEEM_CODE : DIALOGUES.ENDING_B_REDEEM_CODE,
            onRedeem: () => {},
            onComplete: () => {},
        });
        this.envelope.show(W / 2, H * 0.4);
    }

    private spawnBEDebrisBurst(x: number, y: number) {
        for (let i = 0; i < BE_PARAMS.DEBRIS_COUNT; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 3;
            const colorHex = Math.random() > 0.5 ? 0x6b5028 : 0x9b7b3a;
            const img = this.add.image(x, y, '__be_debris')
                .setOrigin(0.5).setDepth(15).setScale(0.3 + Math.random() * 0.4)
                .setTint(colorHex);
            this.beDebris.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1.5,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.15,
                life: 1,
                color: colorHex,
                size: PARAMS.PIXEL_SIZE * 3,
                img,
            });
        }
    }

    private updateBE() {
        if (!this.beActive) return;
        this.time0++;
        const H = CONSTANTS.SCREEN_HEIGHT;

        // --- Phase: idle / wind ---
        if (this.bePhase === 'idle' || this.bePhase === 'wind') {
            // Count remaining decorators
            let remaining = 0;
            for (const rope of this.ropes) {
                for (const n of rope.nodes) {
                    if (n.decorator) remaining++;
                }
            }

            // Auto-trigger gentle breeze when < 10% remain
            if (this.bePhase === 'idle' && this.beTotalDecorators > 0
                && remaining / this.beTotalDecorators < 0.1) {
                this.triggerWindGust();
            }

            if (this.bePhase === 'idle') {
                // Gradual wilt — 0.3x faster
                this.beWiltProgress = Math.min(1, this.beWiltProgress + 0.000104);
                const wiltChance = 0.00026 + this.beWiltProgress * 0.0039;
                for (const rope of this.ropes) {
                    for (const n of rope.nodes) {
                        if (n.decorator && Math.random() < wiltChance) {
                            if (Math.random() < 0.4) {
                                this.witherNode(n);
                            } else {
                                this.spawnBEDeadLeaf(n.x, n.y, n.decorator);
                                n.decorator = '';
                                if (n.img) { n.img.destroy(); n.img = null; }
                            }
                        }
                    }
                }
            } else {
                // Gentle breeze: slowly disperse remaining, no debris bursts
                for (const rope of this.ropes) {
                    for (const n of rope.nodes) {
                        if (n.decorator && Math.random() < 0.008) {
                            this.spawnBEDeadLeaf(n.x, n.y, n.decorator);
                            n.decorator = '';
                            if (n.img) { n.img.destroy(); n.img = null; }
                        }
                    }
                }

                // When all gone, trigger collapse
                if (remaining === 0) {
                    this.bePhase = 'collapse';
                    this.triggerRopeCollapse();
                }
            }

            // Gentle sway (subtle in both phases)
        }

        // --- Wind sway during ALL BE phases (idle, wind, collapse) ---
        {
            const t = this.time0 * 0.008;
            const ampBase = this.bePhase === 'idle' ? 0.04 : 0.1;
            for (const rope of this.ropes) {
                for (let i = 1; i < rope.nodes.length; i++) {
                    const n = rope.nodes[i];
                    if (n.pinned || n.isGrabbed) continue;
                    n.x += Math.sin(t + n.x * 0.01 + i * 0.15) * ampBase;
                }
            }
        }

        // --- Rope physics (all phases) ---
        for (const rope of this.ropes) this.updateRope(rope);

        // --- Draw ropes ---
        this.drawBERopes();

        // --- Update sprite positions ---
        for (const rope of this.ropes) {
            for (const n of rope.nodes) {
                if (n.img) n.img.setPosition(n.x, n.y);
            }
        }

        // --- Update BE dead leaves ---
        for (let i = this.beLeaves.length - 1; i >= 0; i--) {
            const p = this.beLeaves[i];
            const windForce = this.bePhase === 'wind' ? 0.06 : 0.03;
            p.vy += 0.08;
            p.vx += Math.sin(p.swayPhase) * 0.03 + windForce;
            p.swayPhase += 0.05;
            p.vx *= 0.97;
            p.vy *= 0.97;
            p.x += p.vx * 0.15;
            p.y += p.vy * 0.15;
            p.rotation += p.rotSpeed;
            p.life -= 0.003;
            p.img.setPosition(p.x, p.y);
            p.img.setRotation(p.rotation);
            p.img.setAlpha(Math.min(p.life * 2, 1));
            if (p.life <= 0 || p.y > H + 50 || p.x > CONSTANTS.SCREEN_WIDTH + 50 || p.x < -50) {
                p.img.destroy();
                this.beLeaves.splice(i, 1);
            }
        }

        // --- Update debris particles ---
        for (let i = this.beDebris.length - 1; i >= 0; i--) {
            const d = this.beDebris[i];
            d.vy += 0.1;
            d.vx *= 0.98;
            d.vy *= 0.98;
            d.x += d.vx;
            d.y += d.vy;
            d.rotation += d.rotSpeed;
            d.life -= 0.015;
            d.img.setPosition(d.x, d.y);
            d.img.setRotation(d.rotation);
            d.img.setAlpha(Math.min(d.life * 2, 1));
            if (d.life <= 0 || d.y > H + 20) {
                d.img.destroy();
                this.beDebris.splice(i, 1);
            }
        }
    }

    private drawBERopes() {
        const g = this.canvas;
        g.clear();
        const ps = PARAMS.PIXEL_SIZE;

        // Interpolate rope color: HE blue (0xc8dcff) → BE brown (0x7a6b5d)
        const wp = this.beWiltProgress;
        const ropeR = Math.floor(0xc8 + (0x7a - 0xc8) * wp);
        const ropeG = Math.floor(0xdc + (0x6b - 0xdc) * wp);
        const ropeB = Math.floor(0xff + (0x5d - 0xff) * wp);
        const ropeColor = (ropeR << 16) | (ropeG << 8) | ropeB;

        for (const rope of this.ropes) {
            const nodes = rope.nodes;
            g.fillStyle(ropeColor, 0.5);
            for (let i = 0; i < nodes.length - 1; i++) {
                // Skip broken links
                if (nodes[i + 1].brokenAbove) continue;
                this.drawPixelLine(g, ps, nodes[i].x, nodes[i].y, nodes[i + 1].x, nodes[i + 1].y);
            }
        }
    }

    private witherNode(n: VNode) {
        const witherMap: Record<string, string> = {
            '__fc_flower1': '__be_dead_flower1',
            '__fc_flower2': '__be_dead_flower2',
            '__fc_leaf': '__be_dead_leaf',
            // Already withered — no-op
            '__be_dead_flower1': '',
            '__be_dead_flower2': '',
            '__be_dead_leaf': '',
        };
        const deadKey = witherMap[n.texKey];
        if (!deadKey) return;
        n.texKey = deadKey;
        if (n.img) {
            n.img.setTexture(deadKey);
            // Brief scale pulse to make the transition visible
            const origScale = n.img.scaleX;
            this.tweens.add({
                targets: n.img,
                scaleX: origScale * 0.7,
                scaleY: origScale * 0.7,
                duration: 200,
                yoyo: true,
                ease: 'Quad.easeInOut',
            });
        }
    }

    private spawnBEDeadLeaf(x: number, y: number, type: 'flower' | 'leaf') {
        const texKey = type === 'flower' ? '__be_petal_dead_f' : '__be_petal_dead_l';
        const img = this.add.image(x, y, texKey).setOrigin(0.5).setDepth(15)
            .setScale(0.5);
        this.beLeaves.push({
            x, y,
            vx: 0.5 + Math.random() * 1.5,
            vy: -(Math.random() * 1.0 + 0.3),
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.08,
            life: 1,
            swayPhase: Math.random() * Math.PI * 2,
            size: PARAMS.PIXEL_SIZE * 5,
            img,
        });
    }

    // ── Happy Ending — pixel flower curtain ──
    private playHappyEnding() {
        this.active = true;
        const W = CONSTANTS.SCREEN_WIDTH;
        const H = CONSTANTS.SCREEN_HEIGHT;

        this.cameras.main.fadeIn(1000, 0, 0, 0);
        this.cameras.main.setBackgroundColor('#f5f0eb');

        // Generate smooth textures for flowers/leaves
        const ps = PARAMS.PIXEL_SIZE;
        this.genTexSmooth('__fc_flower1', SPRITE_FLOWER, ps);
        this.genTexSmooth('__fc_flower2', SPRITE_FLOWER_2, ps);
        this.genTexSmooth('__fc_leaf', SPRITE_LEAF, ps);
        this.genTexSmooth('__fc_petal_f', SPRITE_PETAL, ps);
        this.genTexSmooth('__fc_petal_l', SPRITE_LEAF, ps);

        // Canvas for pixel-line ropes
        this.canvas = this.add.graphics().setDepth(5);

        // Ropes
        this.ropes = [];
        const spacingX = W / (PARAMS.ROPE_COUNT + 1);
        this.nodeCount = Math.max(20, Math.ceil(H / 18));
        for (let i = 0; i < PARAMS.ROPE_COUNT; i++) {
            const rope = this.createRope((i + 1) * spacingX, H, this.nodeCount);
            this.ropes.push(rope);
        }

        // Butterflies
        this.butterflies = [];
        for (let b = 0; b < 2; b++) {
            const text = this.add.text(-100, -100, '🦋', {
                fontSize: '24px',
            }).setOrigin(0.5).setDepth(20).setVisible(false);
            this.butterflies.push({
                x: 0, y: 0, active: false, targetX: 0,
                baseY: 0, phase: 0, wingPhase: 0, done: false,
                text,
            });
        }

        // Hint
        this.hint = this.add.text(W / 2, 40, '[ 点击屏幕唤出蝴蝶 ]', {
            fontSize: '16px', color: '#666666', fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(100);

        this.time.delayedCall(1000, () => {
            this.input.enabled = true;
            this.input.on('pointerdown', () => this.triggerGather());
        });
    }

    private createRope(startX: number, length: number, count: number): VRope {
        const spacing = length / (count - 1);
        const nodes: VNode[] = [];
        for (let i = 0; i < count; i++) {
            const x = startX;
            const y = i * spacing;
            const rand = Math.random();
            let decorator: 'flower' | 'leaf' | '' = '';
            let texKey = '';
            let spriteSize = 0;

            if (rand > 0.65) {
                decorator = 'flower';
                if (Math.random() > 0.5) { texKey = '__fc_flower1'; } else { texKey = '__fc_flower2'; }
                spriteSize = PARAMS.PIXEL_SIZE * PARAMS.SPRITE_SCALE * 5;
            } else if (rand > 0.35) {
                decorator = 'leaf';
                texKey = '__fc_leaf';
                spriteSize = PARAMS.PIXEL_SIZE * PARAMS.SPRITE_SCALE * 5;
            }

            const node: VNode = {
                x, y, oldX: x, oldY: y,
                pinned: i === 0, isGrabbed: false,
                decorator, texKey, spriteSize,
                img: null,
            };

            if (texKey) {
                node.img = this.add.image(x, y, texKey).setOrigin(0.5).setDepth(6).setScale(0.5);
            }
            nodes.push(node);
        }
        return { nodes, spacing };
    }

    private genTexSmooth(key: string, sprite: string[], pixelSize: number) {
        if (this.textures.exists(key)) this.textures.remove(key);
        const scale = PARAMS.SPRITE_SCALE;
        const rows = sprite.length;
        const cols = sprite[0].length;
        const rw = cols * pixelSize * scale;
        const rh = rows * pixelSize * scale;
        const canvas = document.createElement('canvas');
        canvas.width = rw;
        canvas.height = rh;
        const ctx = canvas.getContext('2d')!;

        // Draw pixel data at high res with soft circles instead of hard squares
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const ch = sprite[r][c];
                if (ch === '0') continue;
                const hex = PALETTE[ch];
                if (!hex) continue;
                const rr = (hex >> 16) & 0xff;
                const gg = (hex >> 8) & 0xff;
                const bb = hex & 0xff;

                const cx = (c + 0.5) * pixelSize * scale;
                const cy = (r + 0.5) * pixelSize * scale;
                const radius = pixelSize * scale * 0.55;

                // Soft glow
                const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.3);
                grad.addColorStop(0, `rgba(${rr},${gg},${bb},0.95)`);
                grad.addColorStop(0.6, `rgba(${rr},${gg},${bb},0.7)`);
                grad.addColorStop(1, `rgba(${rr},${gg},${bb},0)`);
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(cx, cy, radius * 1.3, 0, Math.PI * 2);
                ctx.fill();

                // Core
                ctx.fillStyle = `rgb(${rr},${gg},${bb})`;
                ctx.beginPath();
                ctx.arc(cx, cy, radius * 0.75, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Slight gaussian blur for softness — re-draw smoothed
        const imgData = ctx.getImageData(0, 0, rw, rh);
        const blurred = this.simpleBlur(imgData, 1);
        ctx.putImageData(blurred, 0, 0);

        this.textures.addCanvas(key, canvas);
    }

    private simpleBlur(imgData: ImageData, radius: number): ImageData {
        const w = imgData.width, h = imgData.height;
        const src = imgData.data;
        const out = new Uint8ClampedArray(src.length);
        const size = (radius * 2 + 1) ** 2;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let r = 0, g = 0, b = 0, a = 0;
                for (let dy = -radius; dy <= radius; dy++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        const sx = Math.min(w - 1, Math.max(0, x + dx));
                        const sy = Math.min(h - 1, Math.max(0, y + dy));
                        const i = (sy * w + sx) * 4;
                        r += src[i]; g += src[i + 1]; b += src[i + 2]; a += src[i + 3];
                    }
                }
                const i = (y * w + x) * 4;
                out[i] = r / size; out[i + 1] = g / size;
                out[i + 2] = b / size; out[i + 3] = a / size;
            }
        }
        return new ImageData(out, w, h);
    }

    private triggerGather() {
        if (this.butterflies[0].active) return;

        const H = CONSTANTS.SCREEN_HEIGHT;
        const W = CONSTANTS.SCREEN_WIDTH;
        const grabIdx = Math.floor(this.nodeCount * 0.35) || 10;
        const baseY = grabIdx * (H / this.nodeCount);
        const midX = W / 2;

        // Left butterfly
        const bl = this.butterflies[0];
        bl.active = true; bl.done = false;
        bl.x = midX; bl.y = baseY; bl.baseY = baseY;
        bl.targetX = W * 0.05; bl.phase = 0; bl.wingPhase = 0;
        bl.text.setVisible(true).setPosition(midX, baseY);

        // Right butterfly
        const br = this.butterflies[1];
        br.active = true; br.done = false;
        br.x = midX; br.y = baseY; br.baseY = baseY;
        br.targetX = W * 0.95; br.phase = Math.PI; br.wingPhase = 0;
        br.text.setVisible(true).setPosition(midX, baseY);

        if (this.hint) this.hint.setVisible(false);
    }

    update() {
        if (this.beActive) {
            this.updateBE();
            return;
        }
        if (!this.active) return;
        this.time0++;

        const H = CONSTANTS.SCREEN_HEIGHT;
        const grabIdx = Math.floor(this.nodeCount * 0.35) || 10;
        const midRopeIdx = Math.floor(this.ropes.length / 2);
        const anyActive = this.butterflies[0].active || this.butterflies[1].active;

        // Petal fall chance
        for (const rope of this.ropes) {
            for (const n of rope.nodes) {
                if (n.decorator && Math.random() < PARAMS.PETAL_FALL_CHANCE) {
                    this.spawnPetal(n.x, n.y, n.decorator);
                    n.decorator = '';
                    if (n.img) { n.img.destroy(); n.img = null; }
                }
            }
        }

        // Update petals
        for (let i = this.petals.length - 1; i >= 0; i--) {
            const p = this.petals[i];
            p.vy += 0.06;
            p.vx += Math.sin(p.swayPhase) * 0.04;
            p.swayPhase += 0.06;
            p.vx *= 0.98;
            p.vy *= 0.98;
            p.x += p.vx * 0.10;
            p.y += p.vy * 0.10;
            p.rotation += p.rotSpeed;
            p.life -= 0.002;
            p.img.setPosition(p.x, p.y);
            p.img.setRotation(p.rotation);
            p.img.setAlpha(Math.min(p.life * 2, 1));
            if (p.life <= 0 || p.y > H + 50) {
                p.img.destroy();
                this.petals.splice(i, 1);
            }
        }

        // Butterfly logic
        for (let b = 0; b < 2; b++) {
            const bf = this.butterflies[b];
            if (!bf.active || bf.done) continue;
            bf.wingPhase += 0.25;
            const dx = bf.targetX - bf.x;
            if (Math.abs(dx) > 2) {
                bf.x += Math.sign(dx) * PARAMS.BUTTERFLY_SPEED;
            } else {
                bf.done = true;
            }

            const rStart = b === 0 ? 0 : midRopeIdx;
            const rEnd = b === 0 ? midRopeIdx : this.ropes.length;

            for (let r = rStart; r < rEnd; r++) {
                const tieNode = this.ropes[r].nodes[grabIdx];
                const past = (b === 0) ? (bf.x < tieNode.x) : (bf.x > tieNode.x);
                if (past && !tieNode.isGrabbed) tieNode.isGrabbed = true;
                if (tieNode.isGrabbed) {
                    tieNode.x += (bf.x - tieNode.x) * 0.15;
                    tieNode.y += (bf.y - tieNode.y) * 0.15;
                }
            }

            bf.text.setPosition(bf.x, bf.y);
        }

        // Wind sway
        const bothDone = this.butterflies[0].done && this.butterflies[1].done;
        if (bothDone && !this.envelopeShown) {
            this.envelopeShown = true;
            this.time.delayedCall(3000, () => this.showEnvelope('he'));
        }
        {
            const t = this.time0 * 0.008;
            for (const rope of this.ropes) {
                const grabbed = grabIdx < rope.nodes.length && rope.nodes[grabIdx].isGrabbed;
                for (let i = 1; i < rope.nodes.length; i++) {
                    const n = rope.nodes[i];
                    if (n.pinned || n.isGrabbed) continue;
                    let amp: number;
                    if (bothDone) {
                        amp = 0.03;
                    } else if (anyActive && grabbed && i >= grabIdx) {
                        amp = 0.04;
                    } else if (anyActive) {
                        amp = 0.08;
                    } else {
                        amp = 0.06;
                    }
                    n.x += Math.sin(t + n.x * 0.01 + i * 0.15) * amp;
                }
            }
        }

        // Physics
        for (const rope of this.ropes) this.updateRope(rope);

        // Draw pixel ropes
        this.drawPixelRopes();

        // Update sprite positions
        for (const rope of this.ropes) {
            for (const n of rope.nodes) {
                if (n.img) n.img.setPosition(n.x, n.y);
            }
        }
    }

    private updateRope(rope: VRope) {
        const { nodes, spacing } = rope;
        const len = nodes.length;
        for (let i = 0; i < len; i++) {
            const n = nodes[i];
            if (n.pinned || n.isGrabbed) continue;
            const vx = (n.x - n.oldX) * PARAMS.DAMPING;
            const vy = (n.y - n.oldY) * PARAMS.DAMPING;
            n.oldX = n.x; n.oldY = n.y;
            n.x += vx; n.y += vy + PARAMS.GRAVITY;
        }
        for (let iter = 0; iter < PARAMS.CONSTRAINT_ITERATIONS; iter++) {
            for (let i = 0; i < len - 1; i++) {
                // Skip constraint if the link is broken
                if (nodes[i + 1].brokenAbove) continue;
                const p1 = nodes[i], p2 = nodes[i + 1];
                const dx = p2.x - p1.x, dy = p2.y - p1.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist === 0) continue;
                const diff = (spacing - dist) / dist * 0.5;
                const ox = dx * diff, oy = dy * diff;
                if (!p1.pinned && !p1.isGrabbed) { p1.x -= ox; p1.y -= oy; }
                if (!p2.pinned && !p2.isGrabbed) { p2.x += ox; p2.y += oy; }
            }
        }
    }

    private drawPixelRopes() {
        const g = this.canvas;
        g.clear();
        g.fillStyle(0xc8dcff, 0.5);
        const ps = PARAMS.PIXEL_SIZE;
        for (const rope of this.ropes) {
            const nodes = rope.nodes;
            for (let i = 0; i < nodes.length - 1; i++) {
                this.drawPixelLine(g, ps, nodes[i].x, nodes[i].y, nodes[i + 1].x, nodes[i + 1].y);
            }
        }
    }

    private drawPixelLine(g: Phaser.GameObjects.Graphics, ps: number, x1: number, y1: number, x2: number, y2: number) {
        const dx = Math.abs(x2 - x1);
        const dy = Math.abs(y2 - y1);
        const sx = x1 < x2 ? ps : -ps;
        const sy = y1 < y2 ? ps : -ps;
        let err = dx - dy;
        let cx = x1, cy = y1;
        for (let safety = 0; safety < 2000; safety++) {
            g.fillRect(cx, cy, ps, ps);
            if (Math.abs(cx - x2) < ps && Math.abs(cy - y2) < ps) break;
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; cx += sx; }
            if (e2 < dx) { err += dx; cy += sy; }
        }
    }

    private spawnPetal(x: number, y: number, type: 'flower' | 'leaf') {
        const texKey = type === 'flower' ? '__fc_petal_f' : '__fc_petal_l';
        const img = this.add.image(x, y, texKey).setOrigin(0.5).setDepth(15)
            .setScale(0.5);
        this.petals.push({
            x, y,
            vx: (Math.random() - 0.5) * 1.5,
            vy: Math.random() * 0.5 + 0.2,
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.06,
            life: 1,
            swayPhase: Math.random() * Math.PI * 2,
            size: PARAMS.PIXEL_SIZE * 5,
            img,
        });
    }
}
