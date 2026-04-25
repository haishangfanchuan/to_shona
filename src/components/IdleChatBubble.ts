import * as Phaser from 'phaser';
import { IDLE_CHATS } from '../config/idleChats';
import { drawBubble } from './BubbleDrawer';

const CHAT_DURATION = 1000;
const COOLDOWN = 4000;

type Who = 'player' | 'npc';

export class IdleChatBubble {
    private scene: Phaser.Scene;
    private usedIndices = new Map<Who, Set<number>>();
    private _active = false;
    get isActive() { return this._active; }
    private lastChatTime = 0;
    private followTarget: Phaser.GameObjects.Sprite | null = null;

    private container!: Phaser.GameObjects.Container;
    private bgGraphics!: Phaser.GameObjects.Graphics;
    private chatText!: Phaser.GameObjects.Text;
    private tailSide: 'left' | 'right' = 'right';

    constructor(scene: Phaser.Scene) {
        this.scene = scene;

        this.bgGraphics = scene.add.graphics();
        this.chatText = scene.add.text(0, 0, '', {
            fontSize: '9px',
            color: '#333333',
            fontFamily: 'serif',
            padding: { x: 6, y: 4 },
        }).setOrigin(0.5);

        this.container = scene.add.container(0, 0, [this.bgGraphics, this.chatText])
            .setDepth(62)
            .setVisible(false);
    }

    update(playerX: number, npcX: number, playerSprite: Phaser.GameObjects.Sprite, npcSprite: Phaser.GameObjects.Sprite, blocked = false, waiting = false) {
        if (this._active) {
            if (this.followTarget) {
                this.container.x = this.followTarget.x;
                this.container.y = this.followTarget.y - 60;
            }
            return;
        }

        if (blocked) return;

        const now = this.scene.time.now;
        if (now - this.lastChatTime < COOLDOWN) return;

        if (!waiting) {
            const offset = playerX - npcX;
            if (offset < -40 || offset > 60) return;
        }

        if (Math.random() > 0.02) return;

        this.show(playerSprite, npcSprite);
    }

    private show(playerSprite: Phaser.GameObjects.Sprite, npcSprite: Phaser.GameObjects.Sprite) {
        const who: Who = Math.random() < 0.5 ? 'player' : 'npc';
        const list: readonly string[] = IDLE_CHATS[who];
        if (list.length === 0) return;

        if (!this.usedIndices.has(who)) this.usedIndices.set(who, new Set());
        const used = this.usedIndices.get(who)!;

        if (used.size >= list.length) used.clear();

        const available = list.map((_t, i) => i).filter(i => !used.has(i));
        const pick = available[Math.floor(Math.random() * available.length)];
        used.add(pick);

        const target = who === 'npc' ? npcSprite : playerSprite;
        const other = who === 'npc' ? playerSprite : npcSprite;
        this.followTarget = target;

        this.chatText.setText(list[pick]);

        const targetOnRight = target.x > other.x;
        this.tailSide = targetOnRight ? 'left' : 'right';

        this.container.x = target.x;
        this.container.y = target.y - 60;
        this.container.setAlpha(0).setVisible(true);

        this.chatText.setPosition(0, 0);

        this.drawCloud();

        this._active = true;

        this.scene.tweens.add({
            targets: this.container,
            alpha: { from: 0, to: 1 },
            y: target.y - 66,
            duration: 300,
            ease: 'Sine.easeOut',
        });

        this.scene.time.delayedCall(CHAT_DURATION, () => {
            this.scene.tweens.add({
                targets: this.container,
                alpha: 0,
                duration: 300,
                onComplete: () => {
                    this.container.setVisible(false);
                    this.bgGraphics.clear();
                    this._active = false;
                    this.followTarget = null;
                    this.lastChatTime = this.scene.time.now;
                },
            });
        });
    }

    private drawCloud() {
        drawBubble(this.bgGraphics, 0, 0, this.chatText.width, this.chatText.height, this.tailSide);
    }

    resetUsed() {
        this.usedIndices.clear();
    }
}
