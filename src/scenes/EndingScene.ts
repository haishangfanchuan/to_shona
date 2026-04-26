import * as Phaser from 'phaser';
import { CONSTANTS } from '../config/constants';
import { DIALOGUES } from '../config/dialogues';
import { EnvelopeLetter } from '../components/EnvelopeLetter';
import { EndingTextures } from '../utils/EndingTextures';

// ─── Parameters ───
const PARAMS = {
    ROPE_COUNT: 45,
    GRAVITY: 0.25,
    DAMPING: 0.985,
    CONSTRAINT_ITERATIONS: 4,
    BUTTERFLY_SPEED: 0.1875,
    PETAL_FALL_CHANCE: 0.0008,
    ROPE_WIDTH: 2,
};

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
    private autoGatherTimer?: Phaser.Time.TimerEvent;
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

        // Ensure textures are ready (no-op if already preloaded by SubwayScene)
        EndingTextures.preloadAll(this);

        // Canvas for pixel-line ropes
        this.canvas = this.add.graphics().setDepth(5);

        // Build ropes across multiple frames to avoid jank
        this.ropes = [];
        this.nodeCount = Math.max(20, Math.ceil(H / 18));
        const spacingX = W / (PARAMS.ROPE_COUNT + 1);

        this.buildRopesBatch(spacingX, H, 0, 5, () => {
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
        });
    }

    /** Create ropes in batches over multiple frames to spread the load. */
    private buildRopesBatch(
        spacingX: number, length: number, from: number,
        batchSize: number, onComplete: () => void,
    ) {
        const end = Math.min(from + batchSize, PARAMS.ROPE_COUNT);
        for (let i = from; i < end; i++) {
            const rope = this.createRope((i + 1) * spacingX, length, this.nodeCount);
            this.ropes.push(rope);
        }
        if (end < PARAMS.ROPE_COUNT) {
            this.time.delayedCall(1, () =>
                this.buildRopesBatch(spacingX, length, end, batchSize, onComplete));
        } else {
            onComplete();
        }
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
                .setOrigin(0.5).setDepth(15).setScale(0.15 + Math.random() * 0.2)
                .setTint(colorHex);
            this.beDebris.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1.5,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.15,
                life: 1,
                color: colorHex,
                size: 10,
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
                this.beWiltProgress = Math.min(1, this.beWiltProgress + 0.00015);
                const wiltChance = 0.0005 + this.beWiltProgress * 0.006;
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

        // Interpolate rope color: HE blue (0xc8dcff) → BE brown (0x7a6b5d)
        const wp = this.beWiltProgress;
        const ropeR = Math.floor(0xc8 + (0x7a - 0xc8) * wp);
        const ropeG = Math.floor(0xdc + (0x6b - 0xdc) * wp);
        const ropeB = Math.floor(0xff + (0x5d - 0xff) * wp);
        const ropeColor = (ropeR << 16) | (ropeG << 8) | ropeB;

        g.lineStyle(PARAMS.ROPE_WIDTH, ropeColor, 0.7);
        for (const rope of this.ropes) {
            const nodes = rope.nodes;
            g.beginPath();
            let hasStarted = false;
            for (let i = 0; i < nodes.length - 1; i++) {
                if (nodes[i + 1].brokenAbove) {
                    if (hasStarted) {
                        g.stroke();
                        hasStarted = false;
                    }
                    continue;
                }
                if (!hasStarted) {
                    g.moveTo(nodes[i].x, nodes[i].y);
                    hasStarted = true;
                }
                g.lineTo(nodes[i + 1].x, nodes[i + 1].y);
            }
            if (hasStarted) {
                g.stroke();
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
            .setScale(0.25);
        this.beLeaves.push({
            x, y,
            vx: 0.5 + Math.random() * 1.5,
            vy: -(Math.random() * 1.0 + 0.3),
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.08,
            life: 1,
            swayPhase: Math.random() * Math.PI * 2,
            size: 15,
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

        // Ensure textures are ready (no-op if already preloaded by SubwayScene)
        EndingTextures.preloadAll(this);

        // Canvas for pixel-line ropes
        this.canvas = this.add.graphics().setDepth(5);

        // Build ropes across multiple frames to avoid jank
        this.ropes = [];
        this.nodeCount = Math.max(20, Math.ceil(H / 18));
        const spacingX = W / (PARAMS.ROPE_COUNT + 1);

        this.buildRopesBatch(spacingX, H, 0, 5, () => {
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

            // Auto trigger after 3s, or immediately on user tap
            this.input.enabled = true;
            this.input.on('pointerdown', () => {
                this.triggerGather();
                this.autoGatherTimer?.remove();
            });
            this.autoGatherTimer = this.time.delayedCall(3000, () => this.triggerGather());
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

            if (rand > 0.79) {
                decorator = 'flower';
                if (Math.random() > 0.5) { texKey = '__fc_flower1'; } else { texKey = '__fc_flower2'; }
                spriteSize = 15;
            } else if (rand > 0.57) {
                decorator = 'leaf';
                texKey = '__fc_leaf';
                spriteSize = 15;
            }

            const node: VNode = {
                x, y, oldX: x, oldY: y,
                pinned: i === 0, isGrabbed: false,
                decorator, texKey, spriteSize,
                img: null,
            };

            if (texKey) {
                const s = decorator === 'flower' ? 0.4 : 0.3;
                node.img = this.add.image(x, y, texKey).setOrigin(0.5).setDepth(6).setScale(s);
            }
            nodes.push(node);
        }
        return { nodes, spacing };
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
    }

    update() {
        if (this.beActive) {
            this.updateBE();
            return;
        }
        if (!this.active || !this.butterflies || this.butterflies.length === 0) return;
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

        g.lineStyle(PARAMS.ROPE_WIDTH, 0xc8dcff, 0.7);
        for (const rope of this.ropes) {
            const nodes = rope.nodes;
            g.beginPath();
            g.moveTo(nodes[0].x, nodes[0].y);
            for (let i = 1; i < nodes.length; i++) {
                g.lineTo(nodes[i].x, nodes[i].y);
            }
            g.stroke();
        }
    }

    private spawnPetal(x: number, y: number, type: 'flower' | 'leaf') {
        const texKey = type === 'flower' ? '__fc_petal_f' : '__fc_petal_l';
        const img = this.add.image(x, y, texKey).setOrigin(0.5).setDepth(15)
            .setScale(0.25);
        this.petals.push({
            x, y,
            vx: (Math.random() - 0.5) * 1.5,
            vy: Math.random() * 0.5 + 0.2,
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.06,
            life: 1,
            swayPhase: Math.random() * Math.PI * 2,
            size: 15,
            img,
        });
    }
}
