/*================================================
| Player account: logs in with email + password and keeps the game save on the
| server, so the same game can be picked up from any device.
*/
import { API_BASE_URL } from "./config";
import { GAME_STATE_STORAGE_KEY, onGamePersisted } from "./state/gameState";

const TOKEN_KEY = "pokemmo.authToken";
// Account whose game is in this browser's storage (several people may share a device).
const SAVE_OWNER_KEY = "pokemmo.saveOwner";
const UPLOAD_DELAY_MS = 20 * 1000;

let currentUser = null;

function readStorage(key) {
    try {
        return window.localStorage.getItem(key) || "";
    } catch (e) {
        return "";
    }
}

function writeStorage(key, value) {
    try {
        if (value === null) {
            window.localStorage.removeItem(key);
        } else {
            window.localStorage.setItem(key, value);
        }
    } catch (e) {
        // Private mode: nothing is remembered, the player logs in each time.
    }
}

export function getAuthToken() {
    return readStorage(TOKEN_KEY);
}

export function getCurrentUser() {
    return currentUser;
}

/** Private game code: opened once with ?code=..., then remembered. */
export function getGameCode() {
    const fromUrl = new URLSearchParams(window.location.search).get("code");
    if (fromUrl) {
        writeStorage("pokemmo.gameCode", fromUrl);
        return fromUrl;
    }
    return readStorage("pokemmo.gameCode");
}

async function api(method, path, body, { keepalive = false } = {}) {
    const headers = { "Content-Type": "application/json" };
    const token = getAuthToken();
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    const gameCode = getGameCode();
    if (gameCode) {
        headers["X-Game-Code"] = gameCode;
    }

    let response;
    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
            keepalive
        });
    } catch (e) {
        throw Object.assign(new Error("Serveur injoignable. Vérifie ta connexion."), { status: 0 });
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw Object.assign(new Error(data.error || "Erreur du serveur."), { status: response.status });
    }
    return data;
}

/** Logged-in account from a previous visit, or null if the player must log in. */
export async function resumeSession() {
    if (!getAuthToken()) {
        return null;
    }
    try {
        const { user } = await api("GET", "/me");
        currentUser = user;
        await downloadSave(user);
        return user;
    } catch (error) {
        if (error.status === 401) {
            writeStorage(TOKEN_KEY, null);
            return null;
        }
        throw error;
    }
}

export async function login(email, password) {
    const result = await api("POST", "/auth/login", { email, password });
    return startSession(result);
}

export async function register({ email, password, name, character }) {
    const result = await api("POST", "/auth/register", { email, password, name, character });
    return startSession(result);
}

async function startSession({ token, user }) {
    writeStorage(TOKEN_KEY, token);
    currentUser = user;
    await downloadSave(user);
    return user;
}

export async function logout() {
    await uploadSave().catch(() => {});
    await api("POST", "/auth/logout").catch(() => {});
    writeStorage(TOKEN_KEY, null);
    currentUser = null;
}

/*------------------------------------------------
| Save sync
*/

// Put the account's game in this browser before the game reads it.
async function downloadSave(user) {
    const { save } = await api("GET", "/save");
    const owner = readStorage(SAVE_OWNER_KEY);
    const localSave = readStorage(GAME_STATE_STORAGE_KEY);

    const local = localSave ? JSON.parse(localSave) : null;
    const localIsNewer = local && owner === user.email && (local.timestamp || 0) > (save?.timestamp || 0);

    if (save && !localIsNewer) {
        writeStorage(GAME_STATE_STORAGE_KEY, JSON.stringify(save));
    } else if (localIsNewer) {
        // This device played after its last upload (closed too fast): its game wins.
        await api("PUT", "/save", { save: local });
    } else if (localSave && owner && owner !== user.email) {
        // The game on this device belongs to someone else: this account starts fresh.
        writeStorage(GAME_STATE_STORAGE_KEY, null);
    } else if (localSave) {
        // New account (or first login since accounts exist): keep the progress made on this device.
        await api("PUT", "/save", { save: JSON.parse(localSave) });
    }
    writeStorage(SAVE_OWNER_KEY, user.email);
}

let pendingRecord = null;
let uploadTimer = null;

async function uploadSave({ keepalive = false } = {}) {
    clearTimeout(uploadTimer);
    uploadTimer = null;
    if (!pendingRecord || !currentUser) {
        return;
    }
    const record = pendingRecord;
    pendingRecord = null;
    try {
        await api("PUT", "/save", { save: record }, { keepalive });
    } catch (e) {
        // Try again with the next change.
        pendingRecord = pendingRecord || record;
    }
}

/** Copy the game to the server: on "Sauver", every 20 s while playing, and when leaving. */
export function startSaveSync() {
    onGamePersisted((record, { manual }) => {
        pendingRecord = record;
        if (manual) {
            uploadSave();
        } else if (!uploadTimer) {
            uploadTimer = setTimeout(() => uploadSave(), UPLOAD_DELAY_MS);
        }
    });

    // Browsers cap keepalive requests at 64 KB; bigger saves go as a normal request,
    // and if the page dies first, the next visit on this device sends them (see downloadSave).
    const flush = () => uploadSave({ keepalive: Boolean(pendingRecord) && JSON.stringify(pendingRecord).length < 60000 });
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
            flush();
        }
    });
    window.addEventListener("pagehide", flush);
}

/** Character picked again from the menu: the server also stores it on the account. */
export function rememberCharacter(character) {
    if (currentUser) {
        currentUser = { ...currentUser, character };
    }
}
