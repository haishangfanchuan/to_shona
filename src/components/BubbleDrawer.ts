import * as Phaser from 'phaser';

export function drawBubble(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    textW: number,
    textH: number,
    tailSide: 'left' | 'right' = 'right'
) {
    g.clear();

    const pw = textW / 2 + 7;
    const ph = textH / 2 + 5;

    g.fillStyle(0xFFFFFF, 0.95);

    // Main rounded body
    g.fillRoundedRect(cx - pw, cy - ph, pw * 2, ph * 2, ph);

    // Tail pointing down toward speaker
    const tailH = 5;
    const tailW = 3;
    const tailX = tailSide === 'left' ? cx - pw * 0.2 : cx + pw * 0.2;

    g.fillTriangle(
        tailX - tailW, cy + ph - 1,
        tailX + tailW, cy + ph - 1,
        tailX, cy + ph + tailH
    );

    // Thin border
    g.lineStyle(0.8, 0x000000, 0.12);
    g.strokeRoundedRect(cx - pw, cy - ph, pw * 2, ph * 2, ph);
}
