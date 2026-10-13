import Phaser from "phaser";
import { onlinePlayers, room } from "../SocketServer";
import { buildBattleParty } from "./profile";

/*
 * Meeting other players on the map.
 *
 *  - Walk up to someone: an "A" bubble appears above them.
 *  - Press A: menu with their Pokédex, their badges, or a battle challenge.
 *  - Challenges and battles go through the server (see server/rooms/social.js).
 */
const INTERACTION_DISTANCE = 56;

export default class SocialManager {
    constructor(scene, { ui, pvpBattleUi }) {
        this.scene = scene;
        this.ui = ui;
        this.pvp = pvpBattleUi;
        this.pendingProfile = null; // { sessionId, view: "pokedex" | "badges" }
        this.pendingChallengeId = null;
        this.nearby = null;

        this.interactKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
        this.prompt = scene.add.text(0, 0, "A  ÉCHANGER", {
            fontFamily: "\"Press Start 2P\"",
            fontSize: "8px",
            color: "#ffe066",
            backgroundColor: "#1c1c2e",
            padding: { x: 6, y: 4 }
        }).setOrigin(0.5, 1).setDepth(40).setVisible(false);
    }

    destroy() {
        this.prompt.destroy();
    }

    isBusy() {
        return this.ui.isOpen() || this.pvp.isOpen();
    }

    /* ------------------------------------------------------------------ */
    /* Every frame                                                        */
    /* ------------------------------------------------------------------ */

    update() {
        this.ui.update();
        this.pvp.update();

        const scene = this.scene;
        if (!scene.player || scene.isInterfaceOpen() || scene.npcManager?.activeNpc) {
            this.prompt.setVisible(false);
            this.nearby = null;
            return;
        }

        this.nearby = this.findNearbyPlayer();
        if (!this.nearby) {
            this.prompt.setVisible(false);
            return;
        }

        const target = this.nearby;
        this.prompt.setPosition(Math.round(target.x), Math.round(target.y - target.displayHeight / 2 - 16)).setVisible(true);
        if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
            this.prompt.setVisible(false);
            this.openPlayerMenu(target);
        }
    }

    findNearbyPlayer() {
        const player = this.scene.player;
        let best = null;
        let bestDistance = INTERACTION_DISTANCE;
        Object.entries(onlinePlayers).forEach(([sessionId, other]) => {
            if (!other || other.scene !== this.scene || other.map !== this.scene.mapName || !other.active) {
                return;
            }
            const distance = Phaser.Math.Distance.Between(player.x, player.y, other.x, other.y);
            if (distance <= bestDistance) {
                best = other;
                best.sessionId = sessionId;
                bestDistance = distance;
            }
        });
        return best;
    }

    /* ------------------------------------------------------------------ */
    /* Menu                                                               */
    /* ------------------------------------------------------------------ */

    openPlayerMenu(target) {
        const name = target.playerNickname?.text || "Dresseur";
        this.ui.openMenu(name.toUpperCase(), [
            { id: "pokedex", label: "Pokédex" },
            { id: "badges", label: "Badges" },
            { id: "battle", label: "Combat" },
            { id: "cancel", label: "Retour" }
        ], {
            onSelect: (option) => {
                if (option.id === "pokedex" || option.id === "badges") {
                    this.requestProfile(target.sessionId, option.id, name);
                } else if (option.id === "battle") {
                    this.challenge(target.sessionId, name);
                }
            }
        });
    }

    requestProfile(sessionId, view, name) {
        this.pendingProfile = { sessionId, view };
        this.ui.message(`Chargement du profil de ${name}...`, { sticky: true });
        room.then((currentRoom) => currentRoom.send("GET_PROFILE", { target: sessionId }));
    }

    challenge(sessionId, name) {
        let party;
        try {
            party = buildBattleParty();
        } catch (error) {
            party = [];
        }
        if (!party.length) {
            this.ui.message("Il te faut au moins un Pokémon pour combattre.");
            return;
        }
        this.ui.message(`Envoi du défi à ${name}...`, { sticky: true });
        room.then((currentRoom) => currentRoom.send("PVP_CHALLENGE", { target: sessionId, party }));
    }

    /* ------------------------------------------------------------------ */
    /* Server messages. Returns true when the message was for us.          */
    /* ------------------------------------------------------------------ */

    handleMessage(type, data) {
        switch (type) {
            case "PROFILE":
                this.onProfile(data);
                return true;
            case "PVP_CHALLENGE_SENT":
                this.pendingChallengeId = data.challengeId;
                this.ui.message(`Défi envoyé à ${data.name}. En attente de sa réponse...`, {
                    onCancel: () => {
                        room.then((currentRoom) => currentRoom.send("PVP_CANCEL", { challengeId: data.challengeId }));
                        this.pendingChallengeId = null;
                    },
                    cancelLabel: "Annuler le défi"
                });
                return true;
            case "PVP_CHALLENGED":
                this.onChallenged(data);
                return true;
            case "PVP_CHALLENGE_CANCELLED":
                if (this.ui.mode === "confirm") {
                    this.ui.close();
                }
                this.ui.message(`${data.name || "L'autre joueur"} a annulé son défi.`);
                return true;
            case "PVP_DECLINED":
                this.pendingChallengeId = null;
                this.ui.message({
                    declined: `${data.name} a refusé le combat.`,
                    timeout: `${data.name} n'a pas répondu.`,
                    left: `${data.name || "L'autre joueur"} est parti.`
                }[data.reason] || `${data.name} ne peut pas combattre.`);
                return true;
            case "PVP_ERROR":
                if (!this.pvp.isOpen()) {
                    this.ui.message(data.message || "Action impossible.");
                }
                return true;
            case "PVP_START":
                this.pendingChallengeId = null;
                this.ui.close();
                this.scene.player?.body?.setVelocity(0);
                this.pvp.start(data);
                return true;
            case "PVP_TURN":
                this.pvp.onTurn(data);
                return true;
            case "PVP_WAITING":
                this.pvp.onWaiting();
                return true;
            case "PVP_REJECTED":
                this.pvp.onRejected(data.message);
                return true;
            case "PVP_END":
                this.pvp.onEnd(data);
                return true;
            default:
                return false;
        }
    }

    onProfile(data) {
        const pending = this.pendingProfile;
        if (!pending || pending.sessionId !== data.sessionId) {
            return;
        }
        this.pendingProfile = null;
        if (data.missing) {
            this.ui.message("Ce joueur n'est plus là.");
            return;
        }
        if (pending.view === "badges") {
            this.ui.showBadges(data.name, data.profile);
        } else {
            this.ui.showPokedex(data.name, data.profile);
        }
    }

    onChallenged(data) {
        const respond = (accept) => {
            let party = [];
            if (accept) {
                try {
                    party = buildBattleParty();
                } catch (error) {
                    party = [];
                }
            }
            room.then((currentRoom) => currentRoom.send("PVP_RESPOND", { challengeId: data.challengeId, accept, party }));
        };

        // Already in a wild battle or another fight: say no automatically.
        if (this.scene.isBattleOpen() || this.pvp.isOpen()) {
            respond(false);
            return;
        }

        // Close whatever was open (menu, dialogue) to answer.
        this.scene.closeOverlaysForChallenge?.();
        this.scene.player?.body?.setVelocity(0);
        this.ui.confirm(`${data.from.name} te défie en combat !`, {
            yes: "Accepter",
            no: "Refuser",
            onYes: () => {
                respond(true);
                this.ui.message("Le combat va commencer...", { sticky: true });
            },
            onNo: () => respond(false)
        });
    }
}
