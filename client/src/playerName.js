/*================================================
| Start screen: log in, or create an account (trainer name + character).
| The account keeps the game on the server, see account.js.
| Uses the #name-screen form declared in index.html.
*/
import PlayersAtlasJSON from "./assets/atlas/players";
import PlayersAtlasPNG from "./assets/images/players/players.png";
import { CHARACTERS, DEFAULT_CHARACTER, characterOrDefault } from "./characters";
import { login, register, rememberCharacter, resumeSession, startSaveSync } from "./account";

// Name and character from before accounts existed: offered when creating the account.
const LEGACY_NAME_KEY = "pokemmo.playerName";
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

/** Changed from the in-game menu: the server also saves it on the account. */
export function setPlayerCharacter(id) {
    chosenCharacter = characterOrDefault(id);
    store(CHARACTER_KEY, chosenCharacter);
    rememberCharacter(chosenCharacter);
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

function useAccount(user) {
    chosenCharacter = characterOrDefault(user.character);
    store(CHARACTER_KEY, chosenCharacter);
    startSaveSync();
    return user.name;
}

/** Resolves with the trainer name once the player is logged in and their game is on this device. */
export async function askPlayerName() {
    const screen = document.getElementById("name-screen");

    try {
        const user = await resumeSession();
        if (user) {
            return useAccount(user);
        }
    } catch (error) {
        // Server unreachable: the screen below shows the error when they try to log in.
    }

    const form = screen.querySelector("form");
    const fields = {
        name: form.elements.name,
        email: form.elements.email,
        password: form.elements.password
    };
    const errorText = form.querySelector(".auth-error");
    const submitButtons = form.querySelectorAll("button[type=submit]");

    fields.name.maxLength = MAX_LENGTH;
    fields.name.value = cleanName(readStored(LEGACY_NAME_KEY));
    buildCharacterPicker(form.querySelector(".character-grid"));

    const setMode = (mode) => {
        form.dataset.mode = mode;
        fields.password.autocomplete = mode === "register" ? "new-password" : "current-password";
        errorText.hidden = true;
    };
    // Someone who already played here before accounts existed most likely wants to create one.
    setMode(readStored(LEGACY_NAME_KEY) && !readStored("pokemmo.saveOwner") ? "register" : "login");
    form.querySelectorAll("[data-switch]").forEach((button) => {
        button.addEventListener("click", () => setMode(button.dataset.switch));
    });

    // Keep the game from swallowing letters like Z, X, A, W, S, D while typing.
    Object.values(fields).forEach((input) => {
        ["keydown", "keyup"].forEach((type) => input.addEventListener(type, (event) => event.stopPropagation()));
    });
    // Phaser cancels touches that end outside its canvas, which stops phones from focusing the
    // fields and opening the keyboard: keep this screen's touches away from it.
    ["touchstart", "touchmove", "touchend", "touchcancel"].forEach((type) => {
        screen.addEventListener(type, (event) => event.stopPropagation(), { passive: true });
    });

    screen.hidden = false;

    return new Promise((resolve) => {
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            errorText.hidden = true;
            const registering = form.dataset.mode === "register";
            const email = fields.email.value.trim();
            const password = fields.password.value;
            const name = cleanName(fields.name.value);

            if (registering && !name) {
                showError("Choisis un nom de dresseur.");
                return;
            }
            if (!email || !password) {
                showError("Entre ton e-mail et ton mot de passe.");
                return;
            }

            submitButtons.forEach((button) => { button.disabled = true; });
            try {
                const user = registering
                    ? await register({ email, password, name, character: chosenCharacter || DEFAULT_CHARACTER })
                    : await login(email, password);
                screen.hidden = true;
                document.activeElement?.blur?.();
                resolve(useAccount(user));
            } catch (error) {
                showError(error.message);
            } finally {
                submitButtons.forEach((button) => { button.disabled = false; });
            }
        });
    });

    function showError(message) {
        errorText.textContent = message;
        errorText.hidden = false;
    }
}
