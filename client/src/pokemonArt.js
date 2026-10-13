import Phaser from "phaser";

// Pokémon pictures: the Pokémon HOME renders (smooth, modern) from PokeAPI, resized
// once to 256 px so they stay sharp on screen. The old pixel sprite is the fallback.

const ART_SIZE = 256;
const pending = new Map();

function homeRenderUrl(id) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${id}.png`;
}

export function artKey(id) {
    return `pokemon-art-${id}`;
}

function loadImage(url) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        // Needed to draw it on a canvas the game can use.
        image.crossOrigin = "anonymous";
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = url;
    });
}

/** Loads the picture of a Pokémon; resolves with its texture key, or null if none could be loaded. */
export function loadPokemonArt(scene, id, fallbackUrl) {
    const key = artKey(id);
    const textures = scene.sys.textures;
    if (textures.exists(key)) {
        return Promise.resolve(key);
    }
    if (!pending.has(key)) {
        const task = loadImage(homeRenderUrl(id))
            .then((image) => ({ image, smooth: true }))
            .catch(() => (fallbackUrl ? loadImage(fallbackUrl).then((image) => ({ image, smooth: false })) : null))
            .catch(() => null)
            .then((loaded) => {
                if (!loaded) {
                    return null;
                }
                if (!textures.exists(key)) {
                    const canvas = document.createElement("canvas");
                    canvas.width = ART_SIZE;
                    canvas.height = ART_SIZE;
                    const context = canvas.getContext("2d");
                    context.imageSmoothingEnabled = loaded.smooth;
                    context.imageSmoothingQuality = "high";
                    context.drawImage(loaded.image, 0, 0, ART_SIZE, ART_SIZE);
                    textures.addCanvas(key, canvas);
                    textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
                }
                return key;
            })
            .finally(() => pending.delete(key));
        pending.set(key, task);
    }
    return pending.get(key);
}
