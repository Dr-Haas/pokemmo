const colyseus = require('colyseus');
const { registerSocial } = require('./social');

const DEFAULT_SPAWN = { map: 'town', x: 656, y: 1150 };
const MAX_NAME_LENGTH = 12;

function cleanName(raw) {
    const name = String(raw || '').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, MAX_NAME_LENGTH);
    return name || 'Dresseur';
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
                map: player.map,
                x: player.x,
                y: player.y,
                position: data && data.position
            }, { except: client });
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
    onAuth(client, options) {
        const expected = process.env.GAME_CODE;
        if (!expected) {
            return true;
        }
        if (options && options.code === expected) {
            return true;
        }
        throw new colyseus.ServerError(401, 'Code de partie invalide');
    }

    onJoin(client, options) {
        const name = cleanName(options && options.name);
        console.log('ON JOIN', name);

        this.players[client.sessionId] = {
            sessionId: client.sessionId,
            name,
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
    }

    onDispose() {
        console.log('ON DISPOSE')
    }
};
