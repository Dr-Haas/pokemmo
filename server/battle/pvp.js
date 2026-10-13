/*
 * Player vs player battle, decided by the server so both screens agree.
 *
 * Rules (same damage formula as the wild battles in the client):
 *  - Each turn both players pick a move or a switch.
 *  - Switches happen first, then moves by Speed (random on a tie).
 *  - A fainted Pokémon must be replaced before the next turn.
 *  - Last player with a Pokémon standing wins. Teams are healed at the start
 *    and nothing is kept afterwards, like a link-cable battle.
 */

const STAB_MULTIPLIER = 1.5;
const DAMAGE_VARIANCE_MIN = 0.85;
const DAMAGE_VARIANCE_MAX = 1;

const TYPE_EFFECTIVENESS = {
    Normal: { Rock: 0.5, Ghost: 0, Steel: 0.5 },
    Fire: { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 2, Bug: 2, Rock: 0.5, Dragon: 0.5, Steel: 2 },
    Water: { Fire: 2, Water: 0.5, Grass: 0.5, Ground: 2, Rock: 2, Dragon: 0.5 },
    Electric: { Water: 2, Electric: 0.5, Grass: 0.5, Ground: 0, Flying: 2, Dragon: 0.5 },
    Grass: { Fire: 0.5, Water: 2, Grass: 0.5, Poison: 0.5, Ground: 2, Flying: 0.5, Bug: 0.5, Rock: 2, Dragon: 0.5, Steel: 0.5 },
    Ice: { Fire: 0.5, Water: 0.5, Grass: 2, Ground: 2, Flying: 2, Dragon: 2, Steel: 0.5, Ice: 0.5 },
    Fighting: { Normal: 2, Ice: 2, Poison: 0.5, Flying: 0.5, Psychic: 0.5, Bug: 0.5, Rock: 2, Ghost: 0, Dark: 2, Steel: 2, Fairy: 0.5 },
    Poison: { Grass: 2, Poison: 0.5, Ground: 0.5, Rock: 0.5, Ghost: 0.5, Steel: 0, Fairy: 2 },
    Ground: { Fire: 2, Electric: 2, Grass: 0.5, Poison: 2, Flying: 0, Bug: 0.5, Rock: 2, Steel: 2 },
    Flying: { Electric: 0.5, Grass: 2, Fighting: 2, Bug: 2, Rock: 0.5, Steel: 0.5 },
    Psychic: { Fighting: 2, Poison: 2, Psychic: 0.5, Dark: 0, Steel: 0.5 },
    Bug: { Fire: 0.5, Grass: 2, Fighting: 0.5, Poison: 0.5, Flying: 0.5, Psychic: 2, Ghost: 0.5, Dark: 2, Steel: 0.5, Fairy: 0.5 },
    Rock: { Fire: 2, Ice: 2, Fighting: 0.5, Ground: 0.5, Flying: 2, Bug: 2, Steel: 0.5 },
    Ghost: { Normal: 0, Psychic: 2, Ghost: 2, Dark: 0.5 },
    Dragon: { Dragon: 2, Steel: 0.5, Fairy: 0 },
    Dark: { Fighting: 0.5, Psychic: 2, Ghost: 2, Dark: 0.5, Fairy: 0.5 },
    Steel: { Fire: 0.5, Water: 0.5, Electric: 0.5, Ice: 2, Rock: 2, Steel: 0.5, Fairy: 2 },
    Fairy: { Fire: 0.5, Fighting: 2, Poison: 0.5, Dragon: 2, Dark: 2, Steel: 0.5 }
};

const DAMAGE_CLASSES = new Set(["physical", "special", "status"]);
const STRUGGLE = {
    name: "struggle",
    displayName: "Lutte",
    power: 50,
    accuracy: null,
    type: "Normal",
    damageClass: "physical",
    maxPp: 1,
    pp: 1
};

/* ------------------------------------------------------------------ */
/* Input cleaning: the party comes from the client, keep it sane.      */
/* ------------------------------------------------------------------ */

function int(value, min, max, fallback) {
    const number = Math.round(Number(value));
    if (!Number.isFinite(number)) {
        return fallback;
    }
    return Math.min(max, Math.max(min, number));
}

function text(value, maxLength, fallback = "") {
    const cleaned = String(value == null ? "" : value).slice(0, maxLength);
    return cleaned || fallback;
}

function url(value) {
    const candidate = String(value || "");
    return /^https:\/\/[^\s"'<>]{1,300}$/.test(candidate) ? candidate : "";
}

function sanitizeMove(move) {
    if (!move || typeof move !== "object") {
        return null;
    }
    const damageClass = DAMAGE_CLASSES.has(move.damageClass) ? move.damageClass : "physical";
    const maxPp = int(move.maxPp, 1, 64, 10);
    return {
        name: text(move.name, 30, "tackle"),
        displayName: text(move.displayName || move.name, 30, "Tackle"),
        power: move.power == null ? null : int(move.power, 0, 250, 40),
        accuracy: move.accuracy == null ? null : int(move.accuracy, 1, 100, 100),
        type: text(move.type, 12, "Normal"),
        damageClass,
        maxPp,
        pp: maxPp
    };
}

function sanitizePokemon(pokemon) {
    if (!pokemon || typeof pokemon !== "object") {
        return null;
    }
    const stats = pokemon.stats || {};
    const maxHp = int(stats.maxHp, 1, 999, 20);
    const moves = (Array.isArray(pokemon.moves) ? pokemon.moves : [])
        .slice(0, 4)
        .map(sanitizeMove)
        .filter(Boolean);

    return {
        id: int(pokemon.id, 1, 1025, 1),
        name: text(pokemon.name, 20, "???"),
        level: int(pokemon.level, 1, 100, 5),
        type: (Array.isArray(pokemon.type) ? pokemon.type : [])
            .slice(0, 2)
            .map((entry) => text(entry, 12))
            .filter(Boolean),
        sprite: url(pokemon.sprite),
        backSprite: url(pokemon.backSprite),
        stats: {
            maxHp,
            hp: maxHp,
            attack: int(stats.attack, 1, 999, 10),
            defense: int(stats.defense, 1, 999, 10),
            spAttack: int(stats.spAttack, 1, 999, 10),
            spDefense: int(stats.spDefense, 1, 999, 10),
            speed: int(stats.speed, 1, 999, 10)
        },
        moves: moves.length ? moves : [sanitizeMove({ name: "tackle", displayName: "Tackle", power: 40, accuracy: 100, type: "Normal", damageClass: "physical", maxPp: 35 })]
    };
}

function sanitizeParty(party) {
    return (Array.isArray(party) ? party : [])
        .slice(0, 6)
        .map(sanitizePokemon)
        .filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* Damage                                                              */
/* ------------------------------------------------------------------ */

function getTypeEffectiveness(moveType, defenderTypes) {
    return (defenderTypes || []).reduce((multiplier, defenderType) => {
        const chart = TYPE_EFFECTIVENESS[moveType] || {};
        return multiplier * (chart[defenderType] ?? 1);
    }, 1);
}

function calculateDamage(attacker, defender, move, random) {
    if (!move || move.damageClass === "status" || !move.power) {
        return { damage: 0, effectiveness: 1 };
    }
    const isSpecial = move.damageClass === "special";
    const attackStat = Math.max(1, isSpecial ? attacker.stats.spAttack : attacker.stats.attack);
    const defenseStat = Math.max(1, isSpecial ? defender.stats.spDefense : defender.stats.defense);
    const stab = attacker.type.includes(move.type) ? STAB_MULTIPLIER : 1;
    const effectiveness = getTypeEffectiveness(move.type, defender.type);
    const variance = DAMAGE_VARIANCE_MIN + (random() * (DAMAGE_VARIANCE_MAX - DAMAGE_VARIANCE_MIN));
    const baseDamage = (((attacker.level * 0.4) + 2) * move.power * (attackStat / defenseStat) / 24) + 2;
    const damage = effectiveness === 0 ? 0 : Math.max(1, Math.floor(baseDamage * stab * effectiveness * variance));
    return { damage, effectiveness };
}

/* ------------------------------------------------------------------ */
/* Battle                                                              */
/* ------------------------------------------------------------------ */

function publicPokemon(pokemon) {
    return {
        id: pokemon.id,
        name: pokemon.name,
        level: pokemon.level,
        type: pokemon.type,
        sprite: pokemon.sprite,
        backSprite: pokemon.backSprite,
        stats: { hp: pokemon.stats.hp, maxHp: pokemon.stats.maxHp }
    };
}

class PvpBattle {
    /**
     * @param {string} id
     * @param {{sessionId: string, name: string, party: object[]}} first
     * @param {{sessionId: string, name: string, party: object[]}} second
     * @param {() => number} random  injectable for tests
     */
    constructor(id, first, second, random = Math.random) {
        this.id = id;
        this.random = random;
        this.turn = 0;
        this.ended = false;
        this.result = null;
        this.sides = [first, second].map((side) => ({
            sessionId: side.sessionId,
            name: side.name,
            party: sanitizeParty(side.party),
            active: 0,
            choice: null,
            needsSwitch: false
        }));

        this.sides.forEach((side) => {
            const firstAlive = side.party.findIndex((pokemon) => pokemon.stats.hp > 0);
            side.active = Math.max(0, firstAlive);
        });
    }

    static isValidParty(party) {
        return sanitizeParty(party).length > 0;
    }

    sideOf(sessionId) {
        return this.sides.findIndex((side) => side.sessionId === sessionId);
    }

    other(index) {
        return index === 0 ? 1 : 0;
    }

    activeOf(side) {
        return side.party[side.active];
    }

    hasAlive(side) {
        return side.party.some((pokemon) => pokemon.stats.hp > 0);
    }

    /** What one player is allowed to see. */
    viewFor(sessionId) {
        const index = this.sideOf(sessionId);
        const me = this.sides[index];
        const opponent = this.sides[this.other(index)];
        return {
            battleId: this.id,
            turn: this.turn,
            you: {
                name: me.name,
                active: me.active,
                needsSwitch: me.needsSwitch,
                waitingForChoice: !this.ended && me.choice === null && (me.needsSwitch || !this.anyNeedsSwitch()),
                party: me.party.map((pokemon) => ({
                    ...pokemon,
                    stats: { ...pokemon.stats },
                    moves: pokemon.moves.map((move) => ({ ...move }))
                }))
            },
            opponent: {
                name: opponent.name,
                needsSwitch: opponent.needsSwitch,
                active: publicPokemon(this.activeOf(opponent)),
                remaining: opponent.party.filter((pokemon) => pokemon.stats.hp > 0).length,
                total: opponent.party.length
            }
        };
    }

    anyNeedsSwitch() {
        return this.sides.some((side) => side.needsSwitch);
    }

    /**
     * Register a player's choice.
     * Returns null while waiting for the other player, or the resolved turn:
     * { events: [...], ended: boolean }
     * Throws an Error with a user-facing message if the choice is invalid.
     */
    choose(sessionId, choice) {
        if (this.ended) {
            throw new Error("Le combat est terminé.");
        }
        const index = this.sideOf(sessionId);
        if (index < 0) {
            throw new Error("Tu ne fais pas partie de ce combat.");
        }
        const side = this.sides[index];
        if (side.choice) {
            throw new Error("Choix déjà fait pour ce tour.");
        }

        const switching = this.anyNeedsSwitch();
        if (switching && !side.needsSwitch) {
            throw new Error("Attends que l'autre joueur choisisse son Pokémon.");
        }

        side.choice = this.validateChoice(side, choice, side.needsSwitch);

        if (switching) {
            const waiting = this.sides.filter((entry) => entry.needsSwitch && !entry.choice);
            if (waiting.length) {
                return null;
            }
            return this.resolveForcedSwitches();
        }

        if (this.sides.every((entry) => entry.choice)) {
            return this.resolveTurn();
        }
        return null;
    }

    validateChoice(side, choice, mustSwitch) {
        if (!choice || typeof choice !== "object") {
            throw new Error("Choix invalide.");
        }

        if (choice.type === "switch" || mustSwitch) {
            const target = side.party[int(choice.index, 0, 5, -1)];
            if (choice.type !== "switch" || !target || target.stats.hp <= 0 || side.party.indexOf(target) === side.active) {
                throw new Error("Ce Pokémon ne peut pas combattre.");
            }
            return { type: "switch", index: side.party.indexOf(target) };
        }

        if (choice.type === "move") {
            const active = this.activeOf(side);
            const hasPp = active.moves.some((move) => move.pp > 0);
            if (!hasPp) {
                return { type: "move", index: -1 }; // Struggle
            }
            const move = active.moves[int(choice.index, 0, 3, -1)];
            if (!move || move.pp <= 0) {
                throw new Error("Plus de PP pour cette attaque.");
            }
            return { type: "move", index: active.moves.indexOf(move) };
        }

        throw new Error("Choix invalide.");
    }

    resolveForcedSwitches() {
        const events = [];
        this.sides.forEach((side, index) => {
            if (side.needsSwitch && side.choice) {
                side.active = side.choice.index;
                side.needsSwitch = false;
                events.push({ type: "switch", side: index, index: side.active, pokemon: publicPokemon(this.activeOf(side)) });
            }
            side.choice = null;
        });
        return { events, ended: false };
    }

    resolveTurn() {
        this.turn += 1;
        const events = [];

        // 1. Switches go first.
        this.sides.forEach((side, index) => {
            if (side.choice.type === "switch") {
                side.active = side.choice.index;
                events.push({ type: "switch", side: index, index: side.active, pokemon: publicPokemon(this.activeOf(side)) });
            }
        });

        // 2. Moves, fastest first.
        const movers = this.sides
            .map((side, index) => ({ side, index }))
            .filter(({ side }) => side.choice.type === "move");
        movers.sort((first, second) => {
            const speedDiff = this.activeOf(second.side).stats.speed - this.activeOf(first.side).stats.speed;
            return speedDiff !== 0 ? speedDiff : (this.random() < 0.5 ? -1 : 1);
        });

        for (const { side, index } of movers) {
            const user = this.activeOf(side);
            const targetSide = this.sides[this.other(index)];
            const target = this.activeOf(targetSide);
            if (user.stats.hp <= 0 || target.stats.hp <= 0) {
                continue;
            }

            const move = side.choice.index >= 0 ? user.moves[side.choice.index] : STRUGGLE;
            if (move !== STRUGGLE) {
                move.pp = Math.max(0, move.pp - 1);
            }

            const event = {
                type: "move",
                side: index,
                moveIndex: side.choice.index,
                move: { displayName: move.displayName, type: move.type, damageClass: move.damageClass },
                missed: false,
                damage: 0,
                effectiveness: 1,
                targetHp: target.stats.hp,
                targetMaxHp: target.stats.maxHp,
                fainted: false,
                recoil: 0,
                userHp: user.stats.hp
            };

            if (Number.isFinite(move.accuracy) && this.random() * 100 > move.accuracy) {
                event.missed = true;
                events.push(event);
                continue;
            }

            const outcome = calculateDamage(user, target, move, this.random);
            target.stats.hp = Math.max(0, target.stats.hp - outcome.damage);
            event.damage = outcome.damage;
            event.effectiveness = outcome.effectiveness;
            event.targetHp = target.stats.hp;
            event.fainted = target.stats.hp <= 0;

            if (move === STRUGGLE) {
                event.recoil = Math.max(1, Math.floor(user.stats.maxHp / 4));
                user.stats.hp = Math.max(0, user.stats.hp - event.recoil);
                event.userHp = user.stats.hp;
                event.userFainted = user.stats.hp <= 0;
            }
            events.push(event);
        }

        this.sides.forEach((side) => {
            side.choice = null;
        });

        // 3. Who is out, who must send someone else?
        const alive = this.sides.map((side) => this.hasAlive(side));
        if (!alive[0] || !alive[1]) {
            this.ended = true;
            this.result = !alive[0] && !alive[1]
                ? { winner: null, reason: "draw" }
                : { winner: alive[0] ? 0 : 1, reason: "ko" };
            return { events, ended: true };
        }

        this.sides.forEach((side) => {
            side.needsSwitch = this.activeOf(side).stats.hp <= 0;
        });
        return { events, ended: false };
    }

    forfeit(sessionId, reason = "forfeit") {
        const index = this.sideOf(sessionId);
        if (index < 0 || this.ended) {
            return false;
        }
        this.ended = true;
        this.result = { winner: this.other(index), reason };
        return true;
    }
}

module.exports = { PvpBattle, sanitizeParty, calculateDamage, getTypeEffectiveness };
