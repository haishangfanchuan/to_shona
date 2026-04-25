import './style.css';
import * as Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { StreetScene } from './scenes/StreetScene';
import { CityNightScene } from './scenes/CityNightScene';
import { SubwayScene } from './scenes/SubwayScene';
import { EndingScene } from './scenes/EndingScene';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.WEBGL,
    parent: 'game-container',
    width: 384,
    height: 640,
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0, x: 0 },
            debug: false
        }
    },
    scene: [
        BootScene, TitleScene, StreetScene,
        CityNightScene, SubwayScene, EndingScene
    ]
};

new Phaser.Game(config);



