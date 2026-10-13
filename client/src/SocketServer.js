import * as Colyseus from "colyseus.js";
import { SERVER_URL } from "./config";
import { askPlayerName } from "./playerName";
import { getAuthToken } from "./account";

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
    // The server takes the name and character from the account behind the token.
    .then(() => client.joinOrCreate("poke_world", { token: getAuthToken() }))
    .then((joinedRoom) => {
        console.log(joinedRoom.sessionId, "joined", joinedRoom.name);
        return joinedRoom;
    })
    .catch((e) => {
        console.log("JOIN ERROR", e);
        showConnectionError(e && e.code === 401
            ? "Session expirée : recharge la page pour te reconnecter."
            : null);
        // Never resolve, so the rest of the game simply plays offline.
        return new Promise(() => {});
    });

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
