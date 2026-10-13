/*================================================
| Asks the player for a name and a character once, remembers them on the device.
| Uses the #name-screen form declared in index.html.
*/
import PlayersAtlasJSON from "./assets/atlas/players";
import PlayersAtlasPNG from "./assets/images/players/players.png";
import { CHARACTERS, DEFAULT_CHARACTER, characterOrDefault, isCharacter } from "./characters";

const STORAGE_KEY = "pokemmo.playerName";
const CHARACTER_KEY = "pokemmo.playerCharacter";
const MAX_LENGTH = 12;

let chosenCharacter = characterOrDefault(readStored(CHARACTER_KEY));

function readStored(key) {
    try {
        return window.localStorage.getItem(key) || "";
    } catch (e) {
        return "";
    }
}

function store(key, value) {
    try {
        window.localStorage.setItem(key, value);
    } catch (e) {
        // Private mode: the choice just won't be remembered.
    }
}

export function cleanName(raw) {
    return String(raw || "").replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, MAX_LENGTH);
}

export function getPlayerCharacter() {
    return chosenCharacter;
}

/** Changed from the in-game menu: remembered on the device. */
export function setPlayerCharacter(id) {
    chosenCharacter = characterOrDefault(id);
    store(CHARACTER_KEY, chosenCharacter);
    return chosenCharacter;
}

function atlasFrame(filename) {
    for (const texture of PlayersAtlasJSON.textures || []) {
        const entry = texture.frames.find((frame) => frame.filename === filename);
        if (entry) {
            return entry.frame;
        }
    }
    return null;
}

// One button per character, showing its front sprite cut out of the atlas.
function buildCharacterPicker(container) {
    const sheet = new Image();
    sheet.src = PlayersAtlasPNG;

    const buttons = CHARACTERS.map(({ id, label }) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "character";
        button.setAttribute("role", "radio");
        button.setAttribute("aria-label", label);
        button.dataset.character = id;

        const canvas = document.createElement("canvas");
        const frame = atlasFrame(`${id}_front.png`);
        canvas.width = frame ? frame.w : 32;
        canvas.height = frame ? frame.h : 32;
        const draw = () => frame && canvas.getContext("2d").drawImage(sheet, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
        if (sheet.complete) {
            draw();
        } else {
            sheet.addEventListener("load", draw);
        }

        const name = document.createElement("span");
        name.textContent = label;
        button.append(canvas, name);
        button.addEventListener("click", () => select(id));
        container.appendChild(button);
        return button;
    });

    const select = (id) => {
        chosenCharacter = id;
        buttons.forEach((button) => {
            const selected = button.dataset.character === id;
            button.classList.toggle("is-selected", selected);
            button.setAttribute("aria-checked", String(selected));
        });
    };
    select(chosenCharacter);
}

export function askPlayerName() {
    const storedName = cleanName(readStored(STORAGE_KEY));
    const hasCharacter = isCharacter(readStored(CHARACTER_KEY));
    const screen = document.getElementById("name-screen");

    if ((storedName && hasCharacter) || !screen) {
        return Promise.resolve(storedName || `Dresseur${Math.floor(Math.random() * 900 + 100)}`);
    }

    const form = screen.querySelector("form");
    const input = screen.querySelector("input");
    input.maxLength = MAX_LENGTH;
    input.value = storedName;
    buildCharacterPicker(screen.querySelector(".character-grid"));

    // Keep the game from swallowing letters like Z, X, A, W, S, D while typing.
    ["keydown", "keyup"].forEach((type) => input.addEventListener(type, (event) => event.stopPropagation()));
    // Phaser cancels touches that end outside its canvas, which stops phones from focusing the
    // field and opening the keyboard: keep this screen's touches away from it.
    ["touchstart", "touchmove", "touchend", "touchcancel"].forEach((type) => {
        screen.addEventListener(type, (event) => event.stopPropagation(), { passive: true });
    });

    screen.hidden = false;
    // Let the game canvas render behind, then focus the field (desktop; phones wait for a tap).
    if (!storedName) {
        setTimeout(() => input.focus(), 50);
    }

    return new Promise((resolve) => {
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            const name = cleanName(input.value);
            if (!name) {
                input.focus();
                return;
            }
            store(STORAGE_KEY, name);
            store(CHARACTER_KEY, chosenCharacter || DEFAULT_CHARACTER);
            screen.hidden = true;
            input.blur();
            resolve(name);
        });
    });
}
