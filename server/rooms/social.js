/*
 * Player to player features:
 *  - profiles (name, badges, Pokédex, team) that others can look at
 *  - battle challenges and PvP battles (rules in ../battle/pvp.js)
 */
const { PvpBattle } = require('../battle/pvp');

const CHALLENGE_TIMEOUT_MS = 30000;
const MAX_INTERACTION_DISTANCE = 140;
let nextId = 1;

function int(value, min, max, fallback = 0) {
    const number = Math.round(Number(value));
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function cleanIdList(list) {
    return (Array.isArray(list) ? list : [])
        .slice(0, 1025)
        .map((id) => int(id, 1, 1025, 0))
        .filter(Boolean);
}

function sanitizeProfile(profile) {
    const source = profile && typeof profile === 'object' ? profile : {};
    const pokedex = source.pokedex || {};
    return {
        badges: (Array.isArray(source.badges) ? source.badges : []).slice(0, 8).map((badge, index) => ({
            id: index + 1,
            name: String((badge && badge.name) || `Badge ${index + 1}`).slice(0, 20),
            earned: Boolean(badge && badge.earned)
        })),
        pokedex: {
            seenIds: cleanIdList(pokedex.seenIds),
            caughtIds: cleanIdList(pokedex.caughtIds),
            names: Object.fromEntries(Object.entries(pokedex.names || {})
                .slice(0, 1025)
                .map(([id, name]) => [int(id, 1, 1025, 0), String(name || '').slice(0, 20)])
                .filter(([id, name]) => id && name))
        },
        team: (Array.isArray(source.team) ? source.team : []).slice(0, 6).map((pokemon) => ({
            id: int(pokemon && pokemon.id, 1, 1025, 1),
            name: String((pokemon && pokemon.name) || '???').slice(0, 20),
            level: int(pokemon && pokemon.level, 1, 100, 1)
        })),
        playTime: int(source.playTime, 0, 1e9, 0)
    };
}

function distance(first, second) {
    return Math.hypot((first.x || 0) - (second.x || 0), (first.y || 0) - (second.y || 0));
}

function registerSocial(room) {
    room.profiles = {};
    room.challenges = {}; // challengeId -> { id, from, to, party, timer }
    room.battles = {}; // battleId -> PvpBattle
    room.battleBySession = {}; // sessionId -> battleId

    const clientOf = (sessionId) => room.clients.find((client) => client.sessionId === sessionId);
    const send = (sessionId, type, payload) => {
        const client = clientOf(sessionId);
        if (client) {
            client.send(type, payload);
        }
    };
    const fail = (client, message) => client.send('PVP_ERROR', { message });
    const isBusy = (sessionId) => Boolean(room.battleBySession[sessionId])
        || Object.values(room.challenges).some((challenge) => challenge.from === sessionId || challenge.to === sessionId);

    /* ---------------- Profiles ---------------- */

    room.onMessage('PLAYER_PROFILE', (client, profile) => {
        if (!room.players[client.sessionId]) {
            return;
        }
        room.profiles[client.sessionId] = sanitizeProfile(profile);
    });

    room.onMessage('GET_PROFILE', (client, data) => {
        const target = room.players[data && data.target];
        if (!target) {
            client.send('PROFILE', { sessionId: data && data.target, missing: true });
            return;
        }
        client.send('PROFILE', {
            sessionId: target.sessionId,
            name: target.name,
            profile: room.profiles[target.sessionId] || sanitizeProfile({})
        });
    });

    /* ---------------- Challenges ---------------- */

    const clearChallenge = (challengeId) => {
        const challenge = room.challenges[challengeId];
        if (challenge) {
            clearTimeout(challenge.timer);
            delete room.challenges[challengeId];
        }
        return challenge;
    };

    room.onMessage('PVP_CHALLENGE', (client, data) => {
        const from = room.players[client.sessionId];
        const to = room.players[data && data.target];
        if (!from || !to || to.sessionId === from.sessionId) {
            fail(client, "Ce joueur n'est plus là.");
            return;
        }
        if (from.map !== to.map || distance(from, to) > MAX_INTERACTION_DISTANCE) {
            fail(client, `Rapproche-toi de ${to.name} pour le défier.`);
            return;
        }
        if (isBusy(client.sessionId)) {
            fail(client, 'Tu as déjà un défi ou un combat en cours.');
            return;
        }
        if (isBusy(to.sessionId)) {
            fail(client, `${to.name} est déjà occupé.`);
            return;
        }
        if (!PvpBattle.isValidParty(data.party)) {
            fail(client, "Il te faut au moins un Pokémon pour combattre.");
            return;
        }

        const id = `c${nextId++}`;
        room.challenges[id] = {
            id,
            from: from.sessionId,
            to: to.sessionId,
            party: data.party,
            timer: setTimeout(() => {
                if (clearChallenge(id)) {
                    send(from.sessionId, 'PVP_DECLINED', { challengeId: id, name: to.name, reason: 'timeout' });
                    send(to.sessionId, 'PVP_CHALLENGE_CANCELLED', { challengeId: id, name: from.name });
                }
            }, CHALLENGE_TIMEOUT_MS)
        };

        client.send('PVP_CHALLENGE_SENT', { challengeId: id, name: to.name });
        send(to.sessionId, 'PVP_CHALLENGED', { challengeId: id, from: { sessionId: from.sessionId, name: from.name } });
    });

    room.onMessage('PVP_CANCEL', (client, data) => {
        const challenge = room.challenges[data && data.challengeId];
        if (!challenge || challenge.from !== client.sessionId) {
            return;
        }
        clearChallenge(challenge.id);
        send(challenge.to, 'PVP_CHALLENGE_CANCELLED', { challengeId: challenge.id, name: room.players[challenge.from]?.name });
    });

    room.onMessage('PVP_RESPOND', (client, data) => {
        const challenge = room.challenges[data && data.challengeId];
        if (!challenge || challenge.to !== client.sessionId) {
            fail(client, "Ce défi n'est plus valable.");
            return;
        }
        clearChallenge(challenge.id);

        const from = room.players[challenge.from];
        const to = room.players[challenge.to];
        if (!from || !to) {
            fail(client, "L'autre joueur est parti.");
            return;
        }

        if (!data.accept) {
            send(from.sessionId, 'PVP_DECLINED', { challengeId: challenge.id, name: to.name, reason: 'declined' });
            return;
        }
        if (!PvpBattle.isValidParty(data.party)) {
            fail(client, "Il te faut au moins un Pokémon pour combattre.");
            send(from.sessionId, 'PVP_DECLINED', { challengeId: challenge.id, name: to.name, reason: 'declined' });
            return;
        }

        const battleId = `b${nextId++}`;
        const battle = new PvpBattle(
            battleId,
            { sessionId: from.sessionId, name: from.name, party: challenge.party },
            { sessionId: to.sessionId, name: to.name, party: data.party }
        );
        room.battles[battleId] = battle;
        room.battleBySession[from.sessionId] = battleId;
        room.battleBySession[to.sessionId] = battleId;

        [from.sessionId, to.sessionId].forEach((sessionId) => send(sessionId, 'PVP_START', battle.viewFor(sessionId)));
        console.log('PVP START', from.name, 'vs', to.name);
    });

    /* ---------------- Battle ---------------- */

    const endBattle = (battle) => {
        battle.sides.forEach((side, index) => {
            const result = battle.result.winner === null ? 'draw' : (battle.result.winner === index ? 'win' : 'lose');
            send(side.sessionId, 'PVP_END', {
                battleId: battle.id,
                result,
                reason: battle.result.reason,
                opponentName: battle.sides[index === 0 ? 1 : 0].name
            });
            delete room.battleBySession[side.sessionId];
        });
        delete room.battles[battle.id];
        console.log('PVP END', battle.id, battle.result);
    };

    room.onMessage('PVP_CHOICE', (client, data) => {
        const battle = room.battles[room.battleBySession[client.sessionId]];
        if (!battle) {
            fail(client, "Pas de combat en cours.");
            return;
        }

        let outcome;
        try {
            outcome = battle.choose(client.sessionId, data && data.choice);
        } catch (error) {
            client.send('PVP_REJECTED', { message: error.message });
            return;
        }

        if (!outcome) {
            client.send('PVP_WAITING', { battleId: battle.id });
            return;
        }

        battle.sides.forEach((side, index) => {
            send(side.sessionId, 'PVP_TURN', {
                battleId: battle.id,
                // "me"/"opp" so each screen knows who did what
                events: outcome.events.map((event) => ({ ...event, side: event.side === index ? 'me' : 'opp' })),
                state: battle.viewFor(side.sessionId),
                ended: outcome.ended
            });
        });

        if (outcome.ended) {
            endBattle(battle);
        }
    });

    room.onMessage('PVP_FORFEIT', (client) => {
        const battle = room.battles[room.battleBySession[client.sessionId]];
        if (battle && battle.forfeit(client.sessionId, 'forfeit')) {
            endBattle(battle);
        }
    });

    /* ---------------- Leaving ---------------- */

    room.onSocialLeave = (sessionId) => {
        delete room.profiles[sessionId];

        Object.values(room.challenges).forEach((challenge) => {
            if (challenge.from === sessionId || challenge.to === sessionId) {
                clearChallenge(challenge.id);
                const other = challenge.from === sessionId ? challenge.to : challenge.from;
                send(other, challenge.from === sessionId ? 'PVP_CHALLENGE_CANCELLED' : 'PVP_DECLINED', {
                    challengeId: challenge.id,
                    name: room.players[sessionId]?.name,
                    reason: 'left'
                });
            }
        });

        const battle = room.battles[room.battleBySession[sessionId]];
        if (battle && battle.forfeit(sessionId, 'left')) {
            endBattle(battle);
        }
    };
}

module.exports = { registerSocial, sanitizeProfile };
