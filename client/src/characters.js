// Characters the player can pick on the start screen. They all come from the
// "players" atlas, which has a standing frame and 4 walking frames per direction.
export const CHARACTERS = [
    { id: "red", label: "Red" },
    { id: "misa", label: "Misa" },
    { id: "bob", label: "Bob" },
    { id: "girl1", label: "Lili" },
    { id: "femaletrainer", label: "Dresseuse" },
    { id: "ninja", label: "Ninja" },
    { id: "knight", label: "Chevalier" },
    { id: "professor", label: "Prof" },
    { id: "boss", label: "Boss" },
    { id: "teamxerogrunt1", label: "Sbire" }
];

export const DEFAULT_CHARACTER = "misa";
export const CHARACTER_ATLAS = "players";
const DIRECTIONS = ["left", "right", "front", "back"];

export function isCharacter(id) {
    return CHARACTERS.some((character) => character.id === id);
}

export function characterOrDefault(id) {
    return isCharacter(id) ? id : DEFAULT_CHARACTER;
}

export function standingFrame(character, direction) {
    return `${characterOrDefault(character)}_${direction}.png`;
}

export function walkAnimation(character, direction) {
    return `char-${characterOrDefault(character)}-${direction}-walk`;
}

/** Walking animations for every character, shared by the local and the online players. */
export function createCharacterAnimations(scene) {
    CHARACTERS.forEach(({ id }) => {
        DIRECTIONS.forEach((direction) => {
            const key = walkAnimation(id, direction);
            if (scene.anims.exists(key)) {
                return;
            }
            scene.anims.create({
                key,
                frames: scene.anims.generateFrameNames(CHARACTER_ATLAS, {
                    prefix: `${id}_${direction}_walk.`,
                    suffix: ".png",
                    start: 0,
                    end: 3,
                    zeroPad: 3
                }),
                frameRate: 10,
                repeat: -1
            });
        });
    });
}
