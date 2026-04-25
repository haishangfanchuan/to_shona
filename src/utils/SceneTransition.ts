import * as Phaser from 'phaser';

export function fadeOutScene(scene: Phaser.Scene, duration: number, callback: () => void) {
    scene.cameras.main.fadeOut(duration, 0, 0, 0);
    scene.cameras.main.once('camerafadeoutcomplete', callback);
}

export function fadeInScene(scene: Phaser.Scene, duration: number) {
    scene.cameras.main.fadeIn(duration, 0, 0, 0);
}
