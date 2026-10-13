import * as Colyseus from "colyseus.js";
import { SERVER_URL } from "./config";
import { askPlayerName } from "./playerName";

/*================================================
| Array with current online players
*/
let onlinePlayers = {};

let playerName = "";

/*================================================
| Colyseus connection with server
| The player picks a name first, then we join the room with it.
*/
const client = new Colyseus.Client(SERVER_URL);

const nameReady = askPlayerName().then((name) => {
    playerName = name;
    return name;
});

const room = nameReady
    .then((name) => client.joinOrCreate("poke_world", { name, code: getGameCode() }))
    .then((joinedRoom) => {
        console.log(joinedRoom.sessionId, "joined", joinedRoom.name);
        return joinedRoom;
    })
    .catch((e) => {
        console.log("JOIN ERROR", e);
        showConnectionError(e && e.code === 401
            ? "Code de partie manquant ou faux. Ouvre le lien qu'on t'a envoyé."
            : null);
        // Never resolve, so the rest of the game simply plays offline.
        return new Promise(() => {});
    });

/*------------------------------------------------
| Private game code: opened once with ?code=..., then remembered.
*/
function getGameCode() {
    const fromUrl = new URLSearchParams(window.location.search).get("code");
    try {
        if (fromUrl) {
            window.localStorage.setItem("pokemmo.gameCode", fromUrl);
            return fromUrl;
        }
        return window.localStorage.getItem("pokemmo.gameCode") || "";
    } catch (e) {
        return fromUrl || "";
    }
}

function getPlayerName() {
    return playerName || "Dresseur";
}

function showConnectionError(message) {
    const banner = document.getElementById("connection-error");
    if (banner) {
        if (message) {
            banner.textContent = message;
        }
        banner.hidden = false;
    }
}

export { onlinePlayers, room, nameReady, getPlayerName };
