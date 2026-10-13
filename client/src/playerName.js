/*================================================
| Asks the player for a name once, remembers it on the device.
| Uses the #name-screen form declared in index.html.
*/
const STORAGE_KEY = "pokemmo.playerName";
const MAX_LENGTH = 12;

function readStoredName() {
    try {
        return window.localStorage.getItem(STORAGE_KEY) || "";
    } catch (e) {
        return "";
    }
}

function storeName(name) {
    try {
        window.localStorage.setItem(STORAGE_KEY, name);
    } catch (e) {
        // Private mode: the name just won't be remembered.
    }
}

export function cleanName(raw) {
    return String(raw || "").replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, MAX_LENGTH);
}

export function askPlayerName() {
    const stored = cleanName(readStoredName());
    const screen = document.getElementById("name-screen");

    if (stored || !screen) {
        return Promise.resolve(stored || `Dresseur${Math.floor(Math.random() * 900 + 100)}`);
    }

    const form = screen.querySelector("form");
    const input = screen.querySelector("input");
    input.maxLength = MAX_LENGTH;
    // Keep the game from swallowing letters like Z, X, A, W, S, D while typing.
    ["keydown", "keyup"].forEach((type) => input.addEventListener(type, (event) => event.stopPropagation()));
    screen.hidden = false;
    // Let the game canvas render behind, then focus the field.
    setTimeout(() => input.focus(), 50);

    return new Promise((resolve) => {
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            const name = cleanName(input.value);
            if (!name) {
                input.focus();
                return;
            }
            storeName(name);
            screen.hidden = true;
            input.blur();
            resolve(name);
        });
    });
}
