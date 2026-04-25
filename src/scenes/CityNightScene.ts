import * as Phaser from 'phaser';
import { CONSTANTS } from '../config/constants';
import { Player } from '../components/Player';
import { NPC } from '../components/NPC';
import { VirtualJoystick } from '../components/VirtualJoystick';
import { playPop } from '../components/SoundGenerators';
import { IdleChatBubble } from '../components/IdleChatBubble';
import { EmoteBubble } from '../components/EmoteBubble';

const REST_TRIGGER_X = 745;

export class CityNightScene extends Phaser.Scene {
    private player!: Player;
    private npc!: NPC;
    private joystick!: VirtualJoystick;

    private sceneEnding = false;
    private restTriggered = false;
    private restPopupActive = false;
    private npcWaitingOffscreen = false;
    private isSomeoneWaiting = false;

    private idleChat!: IdleChatBubble;
    private emoteBubble!: EmoteBubble;

    constructor() {
        super({ key: 'CityNightScene' });
    }

    create(_data: { currentTemp?: number; distanceOffset?: number }) {
        const sceneLen = CONSTANTS.SCENE_LENGTH.CITY_NIGHT;

        this.physics.world.setBounds(0, 0, sceneLen + CONSTANTS.SCREEN_WIDTH, CONSTANTS.SCREEN_HEIGHT);

        // 1. Background
        this.add.image(0, 0, 'bg_city').setOrigin(0, 0);

        // 2. NPC (ahead) then Player (behind) — same as StreetScene
        this.npc = new NPC(this, 110, 580);
        this.player = new Player(this, 100, 585);

        // 3. Camera — same as StreetScene
        this.cameras.main.setBounds(0, 0, sceneLen, CONSTANTS.SCREEN_HEIGHT);
        this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0);

        // 4. Fixed temperature bar — 1/4, always blue
        const barX = (CONSTANTS.SCREEN_WIDTH - 160) / 2;
        const barY = 20;
        const barW = 160;
        const barH = 16;
        const barR = 8;
        const fillW = barW * 3 / 4;

        const glowBar = this.add.graphics().setScrollFactor(0).setDepth(98);
        glowBar.setPosition(barX, barY);
        // Warm glow for city night bar
        const barColor = Phaser.Display.Color.GetColor(255, 112, 48);
        glowBar.fillStyle(barColor, 0.15);
        glowBar.fillRoundedRect(-4, -4, barW + 8, barH + 8, barR + 4);

        const bgBar = this.add.graphics().setScrollFactor(0).setDepth(99);
        bgBar.setPosition(barX, barY);
        bgBar.fillStyle(0x1a1a2e, 0.9);
        bgBar.fillRoundedRect(0, 0, barW, barH, barR);
        bgBar.fillStyle(0xffffff, 0.04);
        bgBar.fillRoundedRect(2, 1, barW - 4, barH / 2 - 1, barR - 2);

        // Gradient fill (warm orange)
        const fillBar = this.add.graphics().setScrollFactor(0).setDepth(100);
        fillBar.setPosition(barX, barY);
        const steps = 8;
        for (let i = 0; i < steps; i++) {
            const t = i / (steps - 1);
            const factor = 1.2 - 0.4 * t;
            const sr = Math.min(255, Math.floor(255 * factor));
            const sg = Math.min(255, Math.floor(112 * factor));
            const sb = Math.min(255, Math.floor(48 * factor));
            fillBar.fillStyle(Phaser.Display.Color.GetColor(sr, sg, sb), 1);
            const sliceY = Math.floor(i * barH / steps);
            const nextY = Math.floor((i + 1) * barH / steps);
            const sliceH = nextY - sliceY;
            if (i === 0) {
                fillBar.fillRoundedRect(0, sliceY, fillW, sliceH + 1, { tl: barR, tr: barR, bl: 0, br: 0 });
            } else if (i === steps - 1) {
                fillBar.fillRoundedRect(0, sliceY, fillW, sliceH + 1, { tl: 0, tr: 0, bl: barR, br: barR });
            } else {
                fillBar.fillRect(0, sliceY, fillW, sliceH + 1);
            }
        }

        // Gloss
        const glossBar = this.add.graphics().setScrollFactor(0).setDepth(101);
        glossBar.setPosition(barX, barY);
        glossBar.fillStyle(0xffffff, 0.25);
        glossBar.fillRoundedRect(2, 1, fillW - 4, 5, 3);

        // Border
        const borderBar = this.add.graphics().setScrollFactor(0).setDepth(102);
        borderBar.setPosition(barX, barY);
        borderBar.lineStyle(1.5, 0xffffff, 0.5);
        borderBar.strokeRoundedRect(0, 0, barW, barH, barR);

        // 5. Virtual joystick
        this.joystick = new VirtualJoystick(this);
        this.player.bindJoystick(this.joystick);

        // 6. Idle chat bubble
        this.idleChat = new IdleChatBubble(this);

        // 6.5 Emote bubble
        this.emoteBubble = new EmoteBubble(this);

        // Fade in
        this.cameras.main.fadeIn(500, 0, 0, 0);
    }

    update() {
        if (this.sceneEnding || this.restPopupActive) return;

        // 1. Player input
        this.player.update();

        // 2. NPC step sound (distance-based)
        this.npc.playStepSound(this.player.getX());

        // 2.1 NPC waits if off-screen right — same as StreetScene
        this.handleNpcOffscreen();

        // 3. Waiting at rest trigger point
        this.handleWaiting();

        // 3.5 Idle chat when close
        this.idleChat.update(this.player.getX(), this.npc.getX(), this.player.sprite, this.npc.sprite, this.emoteBubble.isActive, this.isSomeoneWaiting);

        // 3.6 Random emote bubble (skip if chat is showing)
        if (!this.idleChat.isActive) {
            this.emoteBubble.update(this.player.sprite, this.npc.sprite);
        }

        // 4. Both arrived — trigger popup
        if (!this.restPopupActive) {
            this.checkRestTrigger();
        }
    }

    private handleNpcOffscreen() {
        if (this.sceneEnding || this.restPopupActive || this.isSomeoneWaiting) return;

        const camRight = this.cameras.main.scrollX + CONSTANTS.SCREEN_WIDTH;
        const npcX = this.npc.getX();

        if (npcX > camRight) {
            this.npc.stopWalkLowHead();
            this.npcWaitingOffscreen = true;
        } else if (this.npcWaitingOffscreen && npcX <= camRight - 60) {
            this.npc.resumeWalk();
            this.npcWaitingOffscreen = false;
        }
    }

    private handleWaiting() {
        if (this.restPopupActive || this.restTriggered) return;

        const playerX = this.player.getX();
        const npcX = this.npc.getX();

        const playerClose = Math.abs(playerX - REST_TRIGGER_X) < 60;
        const npcClose = Math.abs(npcX - REST_TRIGGER_X) < 60;

        this.isSomeoneWaiting = false;

        if (playerClose && !npcClose) {
            this.isSomeoneWaiting = true;
            const body = this.player.sprite.body as Phaser.Physics.Arcade.Body;
            if (body.velocity.x > CONSTANTS.SPEED.NPC_WALK) {
                this.player.sprite.setVelocityX(CONSTANTS.SPEED.NPC_WALK);
            }
            return;
        } else if (npcClose && !playerClose) {
            this.isSomeoneWaiting = true;
            this.npc.stopWalkLowHead();
            return;
        }

        if (!this.npcWaitingOffscreen) {
            this.npc.resumeWalk();
        }
    }

    private checkRestTrigger() {
        const playerX = this.player.getX();
        const npcX = this.npc.getX();

        const playerClose = Math.abs(playerX - REST_TRIGGER_X) < 40;
        const npcClose = Math.abs(npcX - REST_TRIGGER_X) < 40;

        if (playerClose && npcClose) {
            this.restTriggered = true;
            this.showRestPopup();
        }
    }

    private showRestPopup() {
        this.restPopupActive = true;
        this.physics.pause();
        this.joystick.disable();
        this.player.sprite.anims.pause();
        this.npc.sprite.anims.pause();

        playPop();

        this.time.delayedCall(600, () => {
            const overlay = this.add.rectangle(
                CONSTANTS.SCREEN_WIDTH / 2, CONSTANTS.SCREEN_HEIGHT / 2,
                CONSTANTS.SCREEN_WIDTH, CONSTANTS.SCREEN_HEIGHT,
                0x000000, 0.7
            ).setScrollFactor(0).setDepth(200);

            const text = this.add.text(
                CONSTANTS.SCREEN_WIDTH / 2, CONSTANTS.SCREEN_HEIGHT / 2 - 60,
                '走的好累呀，坐下来休息一下吧。', {
                    fontSize: '18px',
                    color: '#FFB088',
                    fontFamily: 'serif',
                    align: 'center',
                    wordWrap: { width: CONSTANTS.SCREEN_WIDTH - 40, useAdvancedWrap: true }
                }
            ).setOrigin(0.5).setScrollFactor(0).setDepth(201);

            const hint = this.add.text(
                CONSTANTS.SCREEN_WIDTH / 2, CONSTANTS.SCREEN_HEIGHT / 2 + 80,
                '[ 点击继续 ]', {
                    fontSize: '16px',
                    color: '#888888',
                    fontFamily: 'serif'
                }
            ).setOrigin(0.5).setScrollFactor(0).setDepth(201);

            this.tweens.add({
                targets: hint,
                alpha: 0.4,
                duration: 800,
                yoyo: true,
                repeat: -1
            });

            this.input.once('pointerdown', () => {
                overlay.destroy();
                text.destroy();
                hint.destroy();

                this.switchToSubway();
            });
        });
    }

    private switchToSubway() {
        this.sceneEnding = true;
        this.player.disableInput();
        this.joystick.disable();

        this.cameras.main.fadeOut(500, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('SubwayScene');
        });
    }
}
