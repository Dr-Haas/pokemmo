import Phaser from "phaser";
import FireRedBattleUI from "./FireRedBattleUI";

/*
 * Battle screen for player vs player.
 *
 * Same look and animations as the wild battles, but nothing is decided here:
 * the choice is sent to the server, which resolves the turn for both players
 * and sends back what happened. This screen only plays it.
 */
export default class PvpBattleUI extends FireRedBattleUI {
    constructor(scene, { sendChoice, forfeit }) {
        super(scene);
        this.sendChoice = sendChoice;
        this.forfeitBattle = forfeit;
        this.root.setDepth(1250);
        // FIGHT / BAG / POKÉMON / RUN -> run means giving up here.
        this.commandLabels[3].setText("ABANDON");
    }

    /* ------------------------------------------------------------------ */
    /* Server -> screen                                                   */
    /* ------------------------------------------------------------------ */

    async start(view) {
        const party = view.you.party.map(toClientPokemon);
        const opponent = toOpponentPokemon(view.opponent.active);
        const active = party[view.you.active];

        this.battle = {
            pvp: true,
            battleId: view.battleId,
            party,
            activePartyIndex: view.you.active,
            wildPokemon: opponent,
            trainerName: view.you.name,
            opponentName: view.opponent.name,
            finished: false,
            forcedSwitch: false,
            waitingOpponent: false
        };
        this.visible = true;
        this.phase = "busy";
        this.commandIndex = 0;
        this.moveIndex = 0;
        this.switchIndex = 0;
        this.currentLogMessage = "";
        this.root.setVisible(true);

        await Promise.all([this.loadFront(opponent), this.loadBack(active)]);
        if (!this.battle || this.battle.battleId !== view.battleId) {
            return;
        }

        this.resetVisualState();
        this.refreshBattleView(true);
        this.setMessages([
            `${view.opponent.name} veut se battre !`,
            `${view.opponent.name} envoie ${opponent.name} !`,
            `Go ! ${active.name} !`
        ]);
    }

    onTurn({ events, state, ended }) {
        if (!this.battle) {
            return;
        }
        this.phase = "busy";
        this.refreshBattleView();

        this.animationQueue.add(async () => {
            for (const event of events) {
                if (!this.battle) {
                    return;
                }
                await this.playEvent(event);
            }
            if (!this.battle) {
                return;
            }
            this.applyState(state);
            if (!ended) {
                this.enterChoicePhase();
            }
        });
    }

    onEnd({ result, reason, opponentName }) {
        if (!this.battle) {
            return;
        }
        this.animationQueue.add(async () => {
            if (!this.battle) {
                return;
            }
            this.battle.finished = true;
            const messages = [];
            if (result === "win") {
                if (reason === "forfeit") {
                    messages.push(`${opponentName} abandonne !`);
                } else if (reason === "left") {
                    messages.push(`${opponentName} s'est déconnecté.`);
                } else {
                    messages.push(`${opponentName} n'a plus de Pokémon !`);
                }
                messages.push(`Tu as battu ${opponentName} !`);
            } else if (result === "lose") {
                messages.push(reason === "forfeit"
                    ? "Tu as abandonné le combat."
                    : `${opponentName} a gagné le combat...`);
            } else {
                messages.push("Match nul !");
            }
            messages.push("Ton équipe est soignée.");
            this.setMessages(messages);
        });
    }

    onWaiting() {
        if (this.battle && this.phase === "waiting") {
            this.currentLogMessage = `En attente de ${this.battle.opponentName}...`;
            this.refreshMessage();
        }
    }

    onRejected(message) {
        if (!this.battle) {
            return;
        }
        this.setMessages([message]);
    }

    /* ------------------------------------------------------------------ */
    /* Playing what the server decided                                    */
    /* ------------------------------------------------------------------ */

    async playEvent(event) {
        if (event.type === "switch") {
            await this.playSwitch(event);
            return;
        }
        if (event.type === "move") {
            await this.playMove(event);
        }
    }

    async playSwitch(event) {
        if (event.side === "me") {
            const pokemon = this.battle.party[event.index];
            await this.loadBack(pokemon);
            this.battle.activePartyIndex = event.index;
            this.refreshBattleView(true);
            await this.animateSendOut(this.playerSlot);
            await this.showBattleLog(`Go ! ${pokemon.name} !`, 600);
            return;
        }

        const opponent = toOpponentPokemon(event.pokemon);
        await this.loadFront(opponent);
        this.battle.wildPokemon = opponent;
        this.refreshBattleView(true);
        await this.animateSendOut(this.enemySlot);
        await this.showBattleLog(`${this.battle.opponentName} envoie ${opponent.name} !`, 600);
    }

    async playMove(event) {
        const mine = event.side === "me";
        const user = mine ? this.battle.party[this.battle.activePartyIndex] : this.battle.wildPokemon;
        const target = mine ? this.battle.wildPokemon : this.battle.party[this.battle.activePartyIndex];
        const attackerSlot = mine ? this.playerSlot : this.enemySlot;
        const defenderSlot = mine ? this.enemySlot : this.playerSlot;
        const attackerPanel = mine ? this.playerInfo : this.enemyInfo;
        const defenderPanel = mine ? this.enemyInfo : this.playerInfo;
        const userLabel = mine ? user.name : `${user.name} ennemi`;

        if (mine && user.moves[event.moveIndex]) {
            const move = user.moves[event.moveIndex];
            move.currentPp = Math.max(0, move.currentPp - 1);
        }

        await this.showBattleLog(`${userLabel} utilise ${event.move.displayName} !`, 450);

        if (event.missed) {
            await this.animateMiss(attackerSlot, event.move);
            await this.showBattleLog("Mais ça rate !", 500);
            return;
        }

        const hpBefore = target.stats.hp;
        target.stats.hp = event.targetHp;
        await this.animateMove(attackerSlot, defenderSlot, event.move, defenderPanel, target, hpBefore, event.targetHp);

        if (event.damage > 0) {
            await this.showBattleLog(`${target.name} perd ${event.damage} PV !`, 450);
        } else if (event.move.damageClass === "status") {
            await this.showBattleLog("Mais rien ne se passe !", 450);
        } else if (event.effectiveness === 0) {
            await this.showBattleLog(`Ça n'affecte pas ${target.name}...`, 450);
        }
        if (event.effectiveness > 1) {
            await this.showBattleLog("C'est super efficace !", 450);
        } else if (event.effectiveness > 0 && event.effectiveness < 1) {
            await this.showBattleLog("Ce n'est pas très efficace...", 450);
        }

        if (event.recoil > 0) {
            const before = user.stats.hp;
            user.stats.hp = event.userHp;
            await this.animateHpBar(attackerPanel, user, before, event.userHp, 400);
            await this.showBattleLog(`${user.name} subit le contrecoup !`, 450);
            if (event.userFainted) {
                await this.animateFaint(attackerSlot);
                await this.showBattleLog(`${user.name} est K.O. !`, 600);
            }
        }

        if (event.fainted) {
            await this.animateFaint(defenderSlot);
            await this.showBattleLog(`${target.name} est K.O. !`, 600);
        }
    }

    applyState(state) {
        const battle = this.battle;
        state.you.party.forEach((serverPokemon, index) => {
            const local = battle.party[index];
            if (!local) {
                return;
            }
            local.stats.hp = serverPokemon.stats.hp;
            serverPokemon.moves.forEach((move, moveIndex) => {
                if (local.moves[moveIndex]) {
                    local.moves[moveIndex].currentPp = move.pp;
                }
            });
        });
        battle.activePartyIndex = state.you.active;

        const opponent = state.opponent.active;
        if (battle.wildPokemon.id === opponent.id && battle.wildPokemon.name === opponent.name) {
            battle.wildPokemon.stats.hp = opponent.stats.hp;
        } else {
            battle.wildPokemon = toOpponentPokemon(opponent);
        }
        battle.forcedSwitch = Boolean(state.you.needsSwitch);
        battle.waitingOpponent = Boolean(state.opponent.needsSwitch) && !state.you.needsSwitch;
    }

    enterChoicePhase() {
        const battle = this.battle;
        if (!battle || battle.finished) {
            return;
        }
        if (battle.forcedSwitch) {
            this.phase = "party";
            const next = battle.party.findIndex((pokemon, index) => pokemon.stats.hp > 0 && index !== battle.activePartyIndex);
            this.switchIndex = Math.max(0, next);
            this.currentLogMessage = "Choisis ton prochain Pokémon.";
        } else if (battle.waitingOpponent) {
            this.phase = "waiting";
            this.currentLogMessage = `${battle.opponentName} choisit son Pokémon...`;
        } else {
            this.phase = "command";
            this.currentLogMessage = `Que doit faire ${battle.party[battle.activePartyIndex].name} ?`;
        }
        this.refreshBattleView(true);
    }

    /* ------------------------------------------------------------------ */
    /* Player input                                                       */
    /* ------------------------------------------------------------------ */

    advanceMessage() {
        this.messagePage += 1;
        if (this.messagePage < this.messageQueue.length) {
            this.refreshMessage();
            return;
        }
        this.messageQueue = [];
        this.messagePage = 0;
        if (!this.battle || this.battle.finished) {
            this.endBattle();
            return;
        }
        this.enterChoicePhase();
    }

    shouldCloseAfterMessages() {
        return !this.battle || this.battle.finished;
    }

    activateCommand(commandId) {
        if (commandId === "FIGHT") {
            this.phase = "moves";
            this.moveIndex = 0;
            this.refreshBattleView();
            return;
        }
        if (commandId === "POKEMON") {
            this.phase = "party";
            this.switchIndex = this.battle.activePartyIndex;
            this.refreshBattleView();
            return;
        }
        if (commandId === "RUN") {
            this.phase = "waiting";
            this.currentLogMessage = "Tu abandonnes le combat...";
            this.refreshBattleView();
            this.forfeitBattle();
            return;
        }
        this.setMessages(["Pas d'objets dans un combat entre dresseurs."]);
    }

    handleMoveInput() {
        const active = this.battle.party[this.battle.activePartyIndex];
        const moveCount = Math.max(1, active.moves.length);

        if (this.isCancelPressed()) {
            this.phase = "command";
            this.refreshBattleView();
            return;
        }
        if (this.isUpPressed()) {
            this.moveIndex = Phaser.Math.Wrap(this.moveIndex - 1, 0, moveCount);
            this.refreshBattleView();
            return;
        }
        if (this.isDownPressed()) {
            this.moveIndex = Phaser.Math.Wrap(this.moveIndex + 1, 0, moveCount);
            this.refreshBattleView();
            return;
        }
        if (!this.isConfirmPressed()) {
            return;
        }

        const noPpLeft = active.moves.every((move) => move.currentPp <= 0);
        const move = active.moves[this.moveIndex];
        if (noPpLeft || move?.currentPp > 0) {
            // With no PP at all, the server makes the Pokémon struggle.
            this.submit({ type: "move", index: this.moveIndex });
            return;
        }
        this.setMessages(["Plus de PP pour cette attaque !"]);
    }

    handlePartyInput() {
        const battle = this.battle;
        if (this.isCancelPressed() && !battle.forcedSwitch) {
            this.phase = "command";
            this.refreshBattleView();
            return;
        }
        if (this.isUpPressed()) {
            this.switchIndex = Phaser.Math.Wrap(this.switchIndex - 1, 0, battle.party.length);
            this.refreshBattleView();
            return;
        }
        if (this.isDownPressed()) {
            this.switchIndex = Phaser.Math.Wrap(this.switchIndex + 1, 0, battle.party.length);
            this.refreshBattleView();
            return;
        }
        if (!this.isConfirmPressed()) {
            return;
        }

        const pokemon = battle.party[this.switchIndex];
        if (!pokemon || pokemon.stats.hp <= 0) {
            this.currentLogMessage = "Ce Pokémon est K.O. !";
            this.refreshMessage();
            return;
        }
        if (this.switchIndex === battle.activePartyIndex) {
            this.currentLogMessage = `${pokemon.name} est déjà au combat !`;
            this.refreshMessage();
            return;
        }
        this.submit({ type: "switch", index: this.switchIndex });
    }

    submit(choice) {
        this.phase = "waiting";
        this.currentLogMessage = `En attente de ${this.battle.opponentName}...`;
        this.refreshBattleView();
        this.sendChoice(choice);
    }

    // PvP never changes the real team.
    syncPartyState() {}

    /* ------------------------------------------------------------------ */
    /* Sprites                                                            */
    /* ------------------------------------------------------------------ */

    loadFront(pokemon) {
        return this.loadArt(pokemon);
    }

    loadBack(pokemon) {
        return this.loadArt(pokemon);
    }
}

function toClientPokemon(pokemon) {
    return {
        ...pokemon,
        type: [...(pokemon.type || [])],
        stats: { ...pokemon.stats },
        moves: (pokemon.moves || []).map((move) => ({
            ...move,
            currentPp: move.pp,
            maxPp: move.maxPp
        }))
    };
}

function toOpponentPokemon(pokemon) {
    return {
        ...pokemon,
        type: [...(pokemon.type || [])],
        stats: { ...pokemon.stats },
        moves: []
    };
}
