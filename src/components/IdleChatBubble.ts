import { IDLE_CHATS } from '../config/idleChats';

const CHAT_DURATION = 1700;
const COOLDOWN = 2000;

type Who = 'player' | 'npc';

export class IdleChatBubble {
    private scene: Phaser.Scene;
    private usedIndices = new Map<Who, Set<number>>();
    private _active = false;
    get isActive() { return this._active; }
    private lastChatTime = 0;
    private followTarget: Phaser.GameObjects.Sprite | null = null;

    private el: HTMLDivElement;
    private bubbleEl: HTMLDivElement;
    private textEl: HTMLSpanElement;
    private tailEl: HTMLDivElement;
    private fadeTimer: number | null = null;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;

        this.el = document.createElement('div');
        this.el.style.cssText = 'position:absolute;pointer-events:none;z-index:100;transition:opacity 0.3s;opacity:0;display:none;';

        this.bubbleEl = document.createElement('div');
        this.bubbleEl.style.cssText = 'background:rgba(255,255,255,0.95);border-radius:8px;padding:1px 6px;border:1px solid rgba(0,0,0,0.12);position:relative;white-space:nowrap;';

        this.textEl = document.createElement('span');
        this.textEl.style.cssText = 'font-size:10px;color:#333;font-family:serif;line-height:1.2;';

        this.tailEl = document.createElement('div');
        this.tailEl.style.cssText = 'position:absolute;width:0;height:0;bottom:-6px;';

        this.bubbleEl.appendChild(this.textEl);
        this.bubbleEl.appendChild(this.tailEl);
        this.el.appendChild(this.bubbleEl);
        document.body.appendChild(this.el);
    }

    update(playerX: number, npcX: number, playerSprite: Phaser.GameObjects.Sprite, npcSprite: Phaser.GameObjects.Sprite, blocked = false, waiting = false) {
        if (this._active) {
            if (this.followTarget) {
                this.positionAt(this.followTarget);
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

        if (Math.random() > 0.05) return;

        this.show(playerSprite, npcSprite);
    }

    private positionAt(target: Phaser.GameObjects.Sprite) {
        const cam = this.scene.cameras.main;
        const canvas = this.scene.game.canvas;
        const canvasRect = canvas.getBoundingClientRect();

        const scaleX = canvasRect.width / (cam.width * cam.zoom);
        const scaleY = canvasRect.height / (cam.height * cam.zoom);

        // Use actual display height of the sprite (setOrigin is 0.5, 1 so top is y - displayHeight)
        const displayH = target.displayHeight;
        const headY = target.y - displayH - 4;

        const screenX = (target.x - cam.scrollX) * scaleX;
        const screenY = (headY - cam.scrollY) * scaleY;

        const elW = this.el.offsetWidth || 60;
        this.el.style.left = (canvasRect.left + screenX - elW / 2) + 'px';
        this.el.style.top = (canvasRect.top + screenY - 20) + 'px';
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
        this.followTarget = target;

        this.textEl.textContent = list[pick];

        this.bubbleEl.style.borderRadius = '8px';

        // Tail is always centered at bottom, pointing down to the speaker
        this.tailEl.style.cssText = `
            position:absolute;width:0;height:0;bottom:-6px;left:50%;
            transform:translateX(-50%);
            border-left:6px solid transparent;
            border-right:6px solid transparent;
            border-top:6px solid rgba(255,255,255,0.95);
        `;

        this.el.style.display = 'block';
        this.positionAt(target);

        // Force reflow then fade in
        void this.el.offsetWidth;
        this.el.style.opacity = '1';
        this._active = true;

        if (this.fadeTimer !== null) clearTimeout(this.fadeTimer);
        this.fadeTimer = window.setTimeout(() => {
            this.el.style.opacity = '0';
            setTimeout(() => {
                this.el.style.display = 'none';
                this._active = false;
                this.followTarget = null;
                this.lastChatTime = this.scene.time.now;
                this.fadeTimer = null;
            }, 300);
        }, CHAT_DURATION);
    }

    forceShowText(target: Phaser.GameObjects.Sprite, text: string) {
        if (this._active) return;

        this.followTarget = target;
        this.textEl.textContent = text;

        this.bubbleEl.style.borderRadius = '8px';
        this.tailEl.style.cssText = `
            position:absolute;width:0;height:0;bottom:-6px;left:50%;
            transform:translateX(-50%);
            border-left:6px solid transparent;
            border-right:6px solid transparent;
            border-top:6px solid rgba(255,255,255,0.95);
        `;

        this.el.style.display = 'block';
        this.positionAt(target);

        void this.el.offsetWidth;
        this.el.style.opacity = '1';
        this._active = true;

        if (this.fadeTimer !== null) clearTimeout(this.fadeTimer);
        this.fadeTimer = window.setTimeout(() => {
            this.el.style.opacity = '0';
            setTimeout(() => {
                this.el.style.display = 'none';
                this._active = false;
                this.followTarget = null;
                this.lastChatTime = this.scene.time.now;
                this.fadeTimer = null;
            }, 300);
        }, CHAT_DURATION);
    }

    resetUsed() {
        this.usedIndices.clear();
    }

    destroy() {
        if (this.fadeTimer !== null) clearTimeout(this.fadeTimer);
        this.el.remove();
    }
}
