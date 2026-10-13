/*
 * What other players can see about you: badges, Pokédex, team.
 * Sent to the server when the game starts and whenever it changes.
 */
import {
    getBadges,
    getBattleReadyParty,
    getGameState,
    getParty,
    getPlayTime,
    getPokedex,
    subscribeToGameState
} from "../state/gameState";

export function buildProfile() {
    const pokedex = getPokedex();
    const names = {};
    pokedex.forEach((entry) => {
        if (entry.state === "seen" || entry.state === "caught") {
            names[entry.id] = entry.name;
        }
    });

    return {
        badges: getBadges().map((badge) => ({ name: badge.name, earned: badge.earned })),
        pokedex: {
            seenIds: pokedex.filter((entry) => entry.state === "seen" || entry.state === "caught").map((entry) => entry.id),
            caughtIds: pokedex.filter((entry) => entry.state === "caught").map((entry) => entry.id),
            names
        },
        team: getParty().map((pokemon) => ({ id: pokemon.id, name: pokemon.name, level: pokemon.level })),
        playTime: getPlayTime()
    };
}

/** The team as sent for a battle (the server re-checks every value). */
export function buildBattleParty() {
    return getBattleReadyParty().map((pokemon) => ({
        id: pokemon.id,
        name: pokemon.name,
        level: pokemon.level,
        type: pokemon.type,
        sprite: pokemon.sprite,
        backSprite: pokemon.backSprite,
        stats: { ...pokemon.stats },
        moves: (pokemon.moves || []).map((move) => ({
            name: move.name,
            displayName: move.displayName,
            power: move.power,
            accuracy: move.accuracy,
            type: move.type,
            damageClass: move.damageClass,
            maxPp: move.maxPp
        }))
    }));
}

let started = false;

export function startProfileSync(roomPromise) {
    if (started) {
        return;
    }
    started = true;

    let timer = null;
    let lastSent = "";
    const publish = () => {
        timer = null;
        let profile;
        try {
            profile = buildProfile();
        } catch (error) {
            return;
        }
        const serialized = JSON.stringify(profile);
        if (serialized === lastSent) {
            return;
        }
        lastSent = serialized;
        roomPromise.then((room) => room.send("PLAYER_PROFILE", profile));
    };
    const schedule = () => {
        if (!timer) {
            timer = setTimeout(publish, 1500);
        }
    };

    // Play time changes every second: ignore it, it is sent with other changes.
    let lastShape = "";
    subscribeToGameState(() => {
        const state = getGameState();
        const shape = JSON.stringify([
            (state.badges || []).map((badge) => badge.earned),
            (state.pokedex || []).map((entry) => entry.state).join(","),
            (state.party || []).map((pokemon) => [pokemon.id, pokemon.level])
        ]);
        if (shape !== lastShape) {
            lastShape = shape;
            schedule();
        }
    });
    publish();
}
