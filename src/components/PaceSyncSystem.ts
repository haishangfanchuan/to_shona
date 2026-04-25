import { CONSTANTS } from '../config/constants';
import { NPC } from './NPC';
import { TemperatureBar } from './TemperatureBar';
import { VignetteEffect } from './VignetteEffect';

export class PaceSyncSystem {
    private npc: NPC;
    private tempBar: TemperatureBar;
    private vignette: VignetteEffect;

    constructor(npc: NPC, tempBar: TemperatureBar, vignette: VignetteEffect) {
        this.npc = npc;
        this.tempBar = tempBar;
        this.vignette = vignette;
    }

    update(playerX: number, npcX: number) {
        const distance = playerX - npcX;

        if (distance > CONSTANTS.DISTANCE.TOO_FAST) {
            // Player too fast — NPC stops, low head
            if (!this.npc.getIsPaused()) {
                this.npc.stopWalkLowHead();
            }
            this.tempBar.freeze();
            this.vignette.fadeOut();
        } else if (distance < CONSTANTS.DISTANCE.TOO_FAR) {
            // Player too far behind
            this.npc.resumeWalk();
            this.tempBar.unfreeze();
            this.tempBar.decrease();
            this.vignette.fadeIn();
        } else {
            // In sync
            this.npc.resumeWalk();
            this.tempBar.unfreeze();
            this.tempBar.increase();
            this.vignette.fadeOut();
        }
    }
}
