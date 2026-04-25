import * as Phaser from 'phaser';

const EMOTE_DURATION = 500;
const COOLDOWN = 2500;
const COLS = 4;
const ROWS = 16;

export interface EmoteOptions {
    playerRows?: number[];
    npcRows?: number[];
}

export class EmoteBubble {
    private scene: Phaser.Scene;
    private _active = false;
    get isActive() { return this._active; }
    private lastTime = 0;
    private followTarget: Phaser.GameObjects.GameObject | null = null;
    private lastWho: 'player' | 'npc' = 'npc';

    private emote!: Phaser.GameObjects.Sprite;
    private currentAnimKey = '';
    private animCreated = new Set<string>();

    private options: EmoteOptions;

    constructor(scene: Phaser.Scene, options?: EmoteOptions) {
        this.scene = scene;
        this.options = options ?? {};

        this.emote = scene.add.sprite(0, 0, 'emotes', 0)
            .setScale(1.5)
            .setVisible(false)
            .setDepth(62);
    }

    setRows(playerRows: number[], npcRows: number[]) {
        this.options.playerRows = playerRows;
        this.options.npcRows = npcRows;
    }

    private getHeadTop(target: Phaser.GameObjects.GameObject) {
        const img = target as Phaser.GameObjects.Image;
        return img.y - img.displayHeight;
    }

    private getOrCreateAnim(row: number) {
        const key = `emote_row_${row}`;
        if (this.animCreated.has(key)) return key;

        const frames: number[] = [];
        for (let col = 0; col < COLS; col++) {
            frames.push(row * COLS + col);
        }

        this.scene.anims.create({
            key,
            frames: frames.map(f => ({ key: 'emotes', frame: f })),
            frameRate: 8,
            repeat: -1,
        });

        this.animCreated.add(key);
        return key;
    }

    update(playerSprite: Phaser.GameObjects.GameObject, npcSprite: Phaser.GameObjects.GameObject) {
        if (this._active) {
            if (this.followTarget) {
                const img = this.followTarget as Phaser.GameObjects.Image;
                this.emote.x = img.x;
                this.emote.y = this.getHeadTop(this.followTarget) - 16;
            }
            return;
        }

        const now = this.scene.time.now;
        if (now - this.lastTime < COOLDOWN) return;

        if (Math.random() > 0.01) return;

        this.show(playerSprite, npcSprite);
    }

    private pickRow(): number {
        const rows = this.lastWho === 'player'
            ? this.options.playerRows
            : this.options.npcRows;

        if (rows && rows.length > 0) {
            return rows[Math.floor(Math.random() * rows.length)];
        }

        return 1 + Math.floor(Math.random() * (ROWS - 1));
    }

    private show(playerSprite: Phaser.GameObjects.GameObject, npcSprite: Phaser.GameObjects.GameObject) {
        const isPlayer = Math.random() < 0.5;
        this.showFor(isPlayer ? playerSprite : npcSprite, isPlayer ? 'player' : 'npc');
    }

    forceShow(target: Phaser.GameObjects.GameObject, who: 'player' | 'npc') {
        if (this._active) return;
        this.showFor(target, who);
    }

    private showFor(target: Phaser.GameObjects.GameObject, who: 'player' | 'npc') {
        this.followTarget = target;
        this.lastWho = who;

        const img = this.followTarget as Phaser.GameObjects.Image;
        const headY = this.getHeadTop(this.followTarget);

        const row = this.pickRow();
        this.currentAnimKey = this.getOrCreateAnim(row);

        this.emote.setPosition(img.x, headY - 16)
            .setAlpha(0)
            .setVisible(true)
            .play(this.currentAnimKey);

        this._active = true;

        this.scene.tweens.add({
            targets: this.emote,
            alpha: { from: 0, to: 1 },
            y: headY - 22,
            duration: 300,
            ease: 'Sine.easeOut',
        });

        this.scene.time.delayedCall(EMOTE_DURATION, () => {
            this.emote.stop();
            this.scene.tweens.add({
                targets: this.emote,
                alpha: 0,
                duration: 300,
                onComplete: () => {
                    this.emote.setVisible(false);
                    this._active = false;
                    this.followTarget = null;
                    this.lastTime = this.scene.time.now;
                },
            });
        });
    }
}
