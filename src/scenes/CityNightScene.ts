import * as Phaser from 'phaser';
import { CONSTANTS } from '../config/constants';
import { Player } from '../components/Player';
import { NPC } from '../components/NPC';
import { VirtualJoystick } from '../components/VirtualJoystick';
import { TemperatureBar } from '../components/TemperatureBar';
import { PaceSyncSystem } from '../components/PaceSyncSystem';
import { VignetteEffect } from '../components/VignetteEffect';
import { SnowEffect } from '../components/SnowEffect';
import { playPop } from '../components/SoundGenerators';
import { IdleChatBubble } from '../components/IdleChatBubble';
import { EmoteBubble } from '../components/EmoteBubble';

const REST_TRIGGER_X = 745;

export class CityNightScene extends Phaser.Scene {
    private player!: Player;
    private npc!: NPC;
    private joystick!: VirtualJoystick;
    private tempBar!: TemperatureBar;
    private paceSync!: PaceSyncSystem;
    private vignette!: VignetteEffect;
    private snow!: SnowEffect;
    private isFrozen = false;

    private sceneEnding = false;
    private restTriggered = false;
    private restPopupActive = false;
    private npcWaitingOffscreen = false;
    private isSomeoneWaiting = false;
    private npcTooFastBubbleShown = false;
    private npcOffscreenBubbleShown = false;

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

        // 4. Vignette overlay
        this.vignette = new VignetteEffect(this);

        // 4.5 Snow effect (starts when temp hits 0)
        this.snow = new SnowEffect(this);

        // 5. Temperature bar (fixed on screen)
        this.tempBar = new TemperatureBar(this, (CONSTANTS.SCREEN_WIDTH - 160) / 2, 20);
        this.tempBar.setScrollFactor(0, 0);

        // 5.5 Pace sync system
        this.paceSync = new PaceSyncSystem(this.npc, this.tempBar, this.vignette);

        // 6. Virtual joystick
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

        // 3.5 Pace sync (skip when waiting or NPC off-screen)
        if (!this.isSomeoneWaiting && !this.npcWaitingOffscreen) {
            this.paceSync.update(this.player.getX(), this.npc.getX());
        }

        // 3.55 NPC bubble when player too fast
        if (this.npc.getIsPaused() && !this.npcWaitingOffscreen && !this.isSomeoneWaiting) {
            if (!this.npcTooFastBubbleShown) {
                this.idleChat.forceShowText(this.npc.sprite, '等等我，别走太快');
                this.npcTooFastBubbleShown = true;
            }
        } else {
            this.npcTooFastBubbleShown = false;
        }

        // 3.6 Snow + freeze check
        this.snow.update();
        if (!this.isFrozen && this.tempBar.getValue() <= 0) {
            this.isFrozen = true;
            this.tempBar.freeze();
            this.snow.start();
        }
        if (this.isFrozen && this.tempBar.getValue() >= CONSTANTS.TEMPERATURE.MAX / 3) {
            this.isFrozen = false;
            this.tempBar.unfreeze();
            this.snow.stop();
        }

        // 4. Idle chat when close
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

        if (npcX > camRight - 30) {
            this.npc.stopWalkLowHead();
            this.npcWaitingOffscreen = true;
            if (!this.npcOffscreenBubbleShown) {
                this.idleChat.forceShowText(this.npc.sprite, '走快点！');
                this.npcOffscreenBubbleShown = true;
            }
        } else if (this.npcWaitingOffscreen && npcX <= camRight - 60) {
            this.npc.resumeWalk();
            this.npcWaitingOffscreen = false;
            this.npcOffscreenBubbleShown = false;
        }
    }

    private handleWaiting() {
        if (this.restPopupActive || this.restTriggered) return;

        const playerX = this.player.getX();
        const npcX = this.npc.getX();

        const offset = playerX - npcX;
        const inSyncRange = offset >= -40 && offset <= 60;

        const playerClose = Math.abs(playerX - REST_TRIGGER_X) < 60;
        const npcClose = Math.abs(npcX - REST_TRIGGER_X) < 60;

        this.isSomeoneWaiting = false;

        if (playerClose && !npcClose && !inSyncRange) {
            this.isSomeoneWaiting = true;
            const vx = (this.player.sprite.body as Phaser.Physics.Arcade.Body).velocity.x;
            if (vx > CONSTANTS.SPEED.NPC_WALK) {
                this.player.sprite.setVelocityX(CONSTANTS.SPEED.NPC_WALK);
            } else if (vx < -CONSTANTS.SPEED.NPC_WALK) {
                this.player.sprite.setVelocityX(-CONSTANTS.SPEED.NPC_WALK);
            }
            this.tempBar.decreaseFast();
            return;
        } else if (npcClose && !playerClose && !inSyncRange) {
            this.isSomeoneWaiting = true;
            this.npc.stopWalkLowHead();
            this.tempBar.decreaseFast();
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
