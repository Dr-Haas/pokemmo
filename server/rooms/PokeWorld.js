const colyseus = require('colyseus');
const { registerSocial } = require('./social');
const accounts = require('../services/accounts');

const DEFAULT_SPAWN = { map: 'town', x: 272, y: 276 };
const MAX_NAME_LENGTH = 12;

function cleanName(raw) {
    const name = String(raw || '').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, MAX_NAME_LENGTH);
    return name || 'Dresseur';
}

// Sprite name in the client's "players" atlas; the client falls back to a default if unknown.
function cleanCharacter(raw) {
    const character = String(raw || '');
    return /^[a-z0-9]{1,24}$/.test(character) ? character : 'misa';
}

function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

exports.PokeWorld = class extends colyseus.Room {
    onCreate(options) {
        console.log('ON CREATE');
        this.maxClients = 16;
        this.players = {};

        // Profiles, challenges and PvP battles
        registerSocial(this);

        this.onMessage("PLAYER_MOVED", (client, data) => {
            const player = this.players[client.sessionId];
            if (!player || !data || !isFiniteNumber(data.x) || !isFiniteNumber(data.y)) {
                return;
            }

            player.x = data.x;
            player.y = data.y;

            this.broadcast("PLAYER_MOVED", {
                ...player,
                position: data.position
            }, { except: client });
        });

        this.onMessage("PLAYER_MOVEMENT_ENDED", (client, data) => {
            const player = this.players[client.sessionId];
            if (!player) {
                return;
            }

            if (data && isFiniteNumber(data.x) && isFiniteNumber(data.y)) {
                player.x = data.x;
                player.y = data.y;
            }

            this.broadcast("PLAYER_MOVEMENT_ENDED", {
                sessionId: client.sessionId,
                name: player.name,
                character: player.character,
                map: player.map,
                x: player.x,
                y: player.y,
                position: data && data.position
            }, { except: client });
        });

        // Character picked again from the in-game menu.
        this.onMessage("PLAYER_CHANGED_CHARACTER", (client, data) => {
            const player = this.players[client.sessionId];
            if (!player || !data) {
                return;
            }

            player.character = cleanCharacter(data.character);
            accounts.updateProfile(this.userIds[client.sessionId], { character: player.character });
            this.broadcast("PLAYER_CHANGED_CHARACTER", { ...player }, { except: client });
        });

        // Sent by a client once its map is loaded: real map and position.
        this.onMessage("PLAYER_READY", (client, data) => {
            const player = this.players[client.sessionId];
            if (!player || !data) {
                return;
            }

            if (typeof data.map === 'string') {
                player.map = data.map;
            }
            if (isFiniteNumber(data.x) && isFiniteNumber(data.y)) {
                player.x = data.x;
                player.y = data.y;
            }

            client.send("CURRENT_PLAYERS", { players: this.players });
            this.broadcast("PLAYER_CHANGED_MAP", { ...player }, { except: client });
        });

        this.onMessage("PLAYER_CHANGED_MAP", (client, data) => {
            const player = this.players[client.sessionId];
            if (!player || !data || typeof data.map !== 'string') {
                return;
            }

            player.map = data.map;

            client.send("CURRENT_PLAYERS", { players: this.players });

            this.broadcast("PLAYER_CHANGED_MAP", {
                ...player,
                players: this.players
            });
        });
    }

    // Optional private access: set GAME_CODE on the server and share
    // the game link with ?code=... so only your friends can join.
    // Only logged-in players can join; their name and character come from their account.
    onAuth(client, options) {
        const user = accounts.userFromToken(options && options.token);
        if (!user) {
            throw new colyseus.ServerError(401, 'Connexion requise');
        }
        return user;
    }

    onJoin(client, options, user) {
        const name = cleanName(user.name);
        console.log('ON JOIN', name);
        // Kept apart from this.players, which is sent to every client.
        this.userIds = this.userIds || {};
        this.userIds[client.sessionId] = user.id;

        this.players[client.sessionId] = {
            sessionId: client.sessionId,
            name,
            character: cleanCharacter(user.character),
            ...DEFAULT_SPAWN
        };
        // Others see this player once it sends PLAYER_READY with its real position.
    }

    onLeave(client, consented) {
        const player = this.players[client.sessionId];
        console.log('ON LEAVE', player && player.name);

        // Cancel pending challenges, the opponent wins a battle in progress.
        this.onSocialLeave(client.sessionId);

        this.broadcast("PLAYER_LEFT", { sessionId: client.sessionId, map: player && player.map });
        delete this.players[client.sessionId];
        if (this.userIds) {
            delete this.userIds[client.sessionId];
        }
    }

    onDispose() {
        console.log('ON DISPOSE')
    }
};
