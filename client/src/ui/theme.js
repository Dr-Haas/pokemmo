import Phaser from "phaser";

/*================================================
| Look of the game.
|
| The game is laid out on an 800x450 screen (VIEW) but drawn twice as big (ZOOM),
| so text, menus and Pokémon artwork stay sharp while the world keeps its pixel art.
| Scene2 uses one camera for the world and one for the interface, both zoomed.
*/
export const VIEW = { width: 800, height: 450 };
export const ZOOM = 2;

// Every text in the game uses the modern font. The sizes in the code were chosen for
// the old pixel font: this keeps about the same width, a little taller.
export const FONT_FAMILY = "\"Nunito\", \"Trebuchet MS\", sans-serif";
const SIZE_FACTOR = 1.5;

function modernStyle(style = {}) {
    const next = { ...style };
    if (!next.fontFamily || /Press Start/.test(next.fontFamily)) {
        next.fontFamily = FONT_FAMILY;
    }
    const size = parseFloat(next.fontSize);
    if (Number.isFinite(size)) {
        next.fontSize = `${Math.round(size * SIZE_FACTOR)}px`;
    }
    next.fontStyle = next.fontStyle || "800";
    next.resolution = ZOOM * 1.5;
    return next;
}

const originalText = Phaser.GameObjects.GameObjectFactory.prototype.text;
Phaser.GameObjects.GameObjectFactory.prototype.text = function text(x, y, value, style) {
    const gameObject = originalText.call(this, x, y, value, modernStyle(style));
    // Drawn smooth, not with the pixel-art filter.
    gameObject.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    return gameObject;
};

/** Sets up the two cameras of a game scene: the world (follows the player) and the interface. */
export function setUpCameras(scene) {
    const main = scene.cameras.main;
    main.setZoom(ZOOM);
    const ui = scene.cameras.add(0, 0, VIEW.width * ZOOM, VIEW.height * ZOOM).setOrigin(0, 0).setZoom(ZOOM);
    ui.setName("interface");

    // Objects that don't scroll with the world (scrollFactor 0) are the interface.
    const sortObjects = () => {
        scene.children.list.forEach((object) => {
            const isInterface = object.scrollFactorX === 0 && object.scrollFactorY === 0;
            object.cameraFilter = isInterface ? main.id : ui.id;
        });
    };
    scene.events.on(Phaser.Scenes.Events.PRE_RENDER, sortObjects);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.PRE_RENDER, sortObjects));
    return ui;
}
