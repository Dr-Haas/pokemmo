import Phaser from "phaser";
import { Scene1 } from "./Scene1";
import { Scene2 } from "./Scene2";
import { setupTouchControls } from "./touchControls";
import { registerServiceWorker } from "./pwa";

setupTouchControls();
registerServiceWorker();

const Config = {
    type: Phaser.AUTO,
    width: 800,
    height: 450,
    parent: "game-container",
    pixelArt: true,
    // Keep the 800x450 game and scale it to whatever screen it runs on.
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: "arcade",
        arcade: {
            gravity: {y: 0}
        }
    },
    scene: [Scene1, Scene2],
};

const game = new Phaser.Game(Config);

// Handy for debugging from the browser console.
window.__game = game;

export default game;
