import * as Phaser from 'phaser';

/**
 * Pre-generates all canvas textures needed by EndingScene.
 * Call EndingTextures.preloadAll(scene) during SubwayScene.create()
 * so the textures are ready when EndingScene starts — no jank.
 */
export class EndingTextures {

    private static drawRealisticFlower(
        ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number,
        petalColor: number, petalDark: number, centerColor: number,
        _stemColor: number, isWarm: boolean,
    ) {
        const petalCount = 5;
        const petalRadius = size * 0.32;
        const centerRadius = size * 0.12;

        for (let i = 0; i < petalCount; i++) {
            const angle = (Math.PI * 2 / petalCount) * i - Math.PI / 2;
            const px = cx + Math.cos(angle) * size * 0.14;
            const py = cy + Math.sin(angle) * size * 0.14;

            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(angle + Math.PI / 2);

            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, petalRadius);
            const r1 = (petalColor >> 16) & 0xff, g1 = (petalColor >> 8) & 0xff, b1 = petalColor & 0xff;
            const r2 = (petalDark >> 16) & 0xff, g2 = (petalDark >> 8) & 0xff, b2 = petalDark & 0xff;
            grad.addColorStop(0, `rgba(${r1},${g1},${b1},0.95)`);
            grad.addColorStop(0.6, `rgba(${r1},${g1},${b1},0.9)`);
            grad.addColorStop(1, `rgba(${r2},${g2},${b2},0.3)`);

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(0, -size * 0.02);
            ctx.bezierCurveTo(
                petalRadius * 0.5, -petalRadius * 0.5,
                petalRadius * 0.6, -petalRadius * 0.9,
                0, -petalRadius
            );
            ctx.bezierCurveTo(
                -petalRadius * 0.6, -petalRadius * 0.9,
                -petalRadius * 0.5, -petalRadius * 0.5,
                0, -size * 0.02
            );
            ctx.fill();

            ctx.strokeStyle = `rgba(${r2},${g2},${b2},0.3)`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(0, -size * 0.04);
            ctx.lineTo(0, -petalRadius * 0.8);
            ctx.stroke();

            ctx.restore();
        }

        const cr = (centerColor >> 16) & 0xff, cg = (centerColor >> 8) & 0xff, cb = centerColor & 0xff;
        const cGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, centerRadius);
        cGrad.addColorStop(0, `rgba(${cr},${cg},${cb},1)`);
        cGrad.addColorStop(0.7, `rgba(${cr},${cg},${cb},0.9)`);
        cGrad.addColorStop(1, `rgba(${cr},${cg},${cb},0.5)`);
        ctx.fillStyle = cGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, centerRadius, 0, Math.PI * 2);
        ctx.fill();

        for (let i = 0; i < 6; i++) {
            const a = (Math.PI * 2 / 6) * i;
            const dx = Math.cos(a) * centerRadius * 0.55;
            const dy = Math.sin(a) * centerRadius * 0.55;
            ctx.fillStyle = isWarm ? 'rgba(255,180,80,0.7)' : 'rgba(255,220,120,0.7)';
            ctx.beginPath();
            ctx.arc(cx + dx, cy + dy, 1.2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    private static drawRealisticLeaf(
        ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number,
        color: number, darkColor: number,
    ) {
        const r1 = (color >> 16) & 0xff, g1 = (color >> 8) & 0xff, b1 = color & 0xff;
        const r2 = (darkColor >> 16) & 0xff, g2 = (darkColor >> 8) & 0xff, b2 = darkColor & 0xff;

        const leafW = size * 0.2;
        const leafH = size * 0.42;

        const grad = ctx.createLinearGradient(cx, cy - leafH, cx, cy + leafH);
        grad.addColorStop(0, `rgba(${r1},${g1},${b1},0.95)`);
        grad.addColorStop(0.5, `rgba(${r2},${g2},${b2},0.9)`);
        grad.addColorStop(1, `rgba(${r1},${g1},${b1},0.85)`);
        ctx.fillStyle = grad;

        ctx.beginPath();
        ctx.moveTo(cx, cy - leafH);
        ctx.bezierCurveTo(cx + leafW * 1.2, cy - leafH * 0.5, cx + leafW * 1.0, cy + leafH * 0.3, cx, cy + leafH);
        ctx.bezierCurveTo(cx - leafW * 1.0, cy + leafH * 0.3, cx - leafW * 1.2, cy - leafH * 0.5, cx, cy - leafH);
        ctx.fill();

        ctx.strokeStyle = `rgba(${r2},${g2},${b2},0.5)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy - leafH * 0.9);
        ctx.lineTo(cx, cy + leafH * 0.9);
        ctx.stroke();

        for (let i = 0; i < 3; i++) {
            const t = 0.2 + i * 0.25;
            const vy = cy - leafH + leafH * 2 * t;
            const vw = leafW * 0.6 * (1 - Math.abs(t - 0.5) * 1.5);
            ctx.strokeStyle = `rgba(${r2},${g2},${b2},0.3)`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(cx, vy);
            ctx.lineTo(cx + vw, vy - leafH * 0.12);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx, vy);
            ctx.lineTo(cx - vw, vy - leafH * 0.12);
            ctx.stroke();
        }

        const hlGrad = ctx.createRadialGradient(cx - leafW * 0.3, cy - leafH * 0.2, 0, cx, cy, leafH * 0.6);
        hlGrad.addColorStop(0, 'rgba(255,255,255,0.15)');
        hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hlGrad;
        ctx.beginPath();
        ctx.moveTo(cx, cy - leafH);
        ctx.bezierCurveTo(cx + leafW * 1.2, cy - leafH * 0.5, cx + leafW * 1.0, cy + leafH * 0.3, cx, cy + leafH);
        ctx.bezierCurveTo(cx - leafW * 1.0, cy + leafH * 0.3, cx - leafW * 1.2, cy - leafH * 0.5, cx, cy - leafH);
        ctx.fill();
    }

    private static drawRealisticPetal(
        ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number,
        color: number, darkColor: number,
    ) {
        const r1 = (color >> 16) & 0xff, g1 = (color >> 8) & 0xff, b1 = color & 0xff;
        const r2 = (darkColor >> 16) & 0xff, g2 = (darkColor >> 8) & 0xff, b2 = darkColor & 0xff;

        const pw = size * 0.22;
        const ph = size * 0.35;

        const grad = ctx.createRadialGradient(cx, cy - ph * 0.3, 0, cx, cy, ph);
        grad.addColorStop(0, `rgba(${r1},${g1},${b1},0.95)`);
        grad.addColorStop(0.7, `rgba(${r1},${g1},${b1},0.85)`);
        grad.addColorStop(1, `rgba(${r2},${g2},${b2},0.4)`);
        ctx.fillStyle = grad;

        ctx.beginPath();
        ctx.moveTo(cx, cy - ph);
        ctx.bezierCurveTo(cx + pw, cy - ph * 0.4, cx + pw * 0.8, cy + ph * 0.5, cx, cy + ph * 0.7);
        ctx.bezierCurveTo(cx - pw * 0.8, cy + ph * 0.5, cx - pw, cy - ph * 0.4, cx, cy - ph);
        ctx.fill();
    }

    private static drawDebris(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
        const w = size * 0.15;
        const h = size * 0.25;

        ctx.fillStyle = 'rgba(107,80,40,0.8)';
        ctx.beginPath();
        ctx.moveTo(cx - w, cy - h);
        ctx.bezierCurveTo(cx + w * 0.5, cy - h * 0.6, cx + w, cy + h * 0.3, cx + w * 0.3, cy + h);
        ctx.bezierCurveTo(cx - w * 0.5, cy + h * 0.5, cx - w * 1.2, cy, cx - w, cy - h);
        ctx.fill();
    }

    private static genTexHE(scene: Phaser.Scene, key: string) {
        if (scene.textures.exists(key)) return;
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, size, size);

        const cx = size / 2, cy = size / 2;

        if (key.includes('flower1')) {
            EndingTextures.drawRealisticFlower(ctx, cx, cy, size, 0xffb7c5, 0xe8789a, 0xffd4e8, 0x7ec850, false);
        } else if (key.includes('flower2')) {
            EndingTextures.drawRealisticFlower(ctx, cx, cy, size, 0xff6b8a, 0xff6b8a, 0xffda6b, 0x7ec850, true);
        } else if (key.includes('petal_f')) {
            EndingTextures.drawRealisticPetal(ctx, cx, cy, size, 0xffb7c5, 0xe8789a);
        } else if (key.includes('petal_l') || key.includes('leaf')) {
            EndingTextures.drawRealisticLeaf(ctx, cx, cy, size, 0x7ec850, 0x4a8c2a);
        }

        scene.textures.addCanvas(key, canvas);
    }

    private static genTexBE(scene: Phaser.Scene, key: string) {
        if (scene.textures.exists(key)) return;
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, size, size);

        const cx = size / 2, cy = size / 2;

        if (key.includes('dead_flower1')) {
            EndingTextures.drawRealisticFlower(ctx, cx, cy, size, 0xa08060, 0x7a5a3a, 0x9a8460, 0x8a7a58, false);
        } else if (key.includes('dead_flower2')) {
            EndingTextures.drawRealisticFlower(ctx, cx, cy, size, 0x6a5038, 0x5c4033, 0x807060, 0x8a7a58, false);
        } else if (key.includes('debris')) {
            EndingTextures.drawDebris(ctx, cx, cy, size);
        } else if (key.includes('petal_dead_f')) {
            EndingTextures.drawRealisticPetal(ctx, cx, cy, size, 0xa08060, 0x7a5a3a);
        } else if (key.includes('petal_dead_l') || key.includes('dead_leaf')) {
            EndingTextures.drawRealisticLeaf(ctx, cx, cy, size, 0x8a7a58, 0x5a4a30);
        }

        scene.textures.addCanvas(key, canvas);
    }

    /** Pre-generate ALL EndingScene textures onto the shared TextureManager. */
    static preloadAll(scene: Phaser.Scene) {
        // HE textures
        EndingTextures.genTexHE(scene, '__fc_flower1');
        EndingTextures.genTexHE(scene, '__fc_flower2');
        EndingTextures.genTexHE(scene, '__fc_leaf');
        EndingTextures.genTexHE(scene, '__fc_petal_f');
        EndingTextures.genTexHE(scene, '__fc_petal_l');
        // BE textures
        EndingTextures.genTexBE(scene, '__be_dead_flower1');
        EndingTextures.genTexBE(scene, '__be_dead_flower2');
        EndingTextures.genTexBE(scene, '__be_dead_leaf');
        EndingTextures.genTexBE(scene, '__be_petal_dead_f');
        EndingTextures.genTexBE(scene, '__be_petal_dead_l');
        EndingTextures.genTexBE(scene, '__be_debris');
    }
}
