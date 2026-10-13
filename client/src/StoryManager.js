import Phaser from "phaser";
import {
    addBagItem,
    createBattlePokemonFromCatalog,
    earnBadge,
    getParty,
    getStoryFlag,
    getStoryValue,
    getTrainerName,
    givePokemon,
    healParty,
    isTrainerDefeated,
    markTrainerDefeated,
    setStoryFlag
} from "./state/gameState";
import { PEOPLE, PROFESSOR_NAME, RIVAL_NAME, RIVAL_STARTER, SHOPS, STARTERS, TRAINERS } from "./data/story";
import { interiorStyleFor } from "./HouseInteriorManager";
import { CHARACTER_ATLAS } from "./characters";
import StoryDialogUI from "./ui/StoryDialogUI";
import ShopUI from "./ui/ShopUI";

// The adventure on the current map: people and trainers, what they say, the events
// (the Professor stopping you at Route 1, choosing a starter, the rival, Pierre's badge).

const TILE = 32;
const FONT_FAMILY = "\"Press Start 2P\"";
const LAB = "house@town@21@15";
const DIRECTIONS = { front: [0, 1], back: [0, -1], left: [-1, 0], right: [1, 0] };

export default class StoryManager {
    constructor(scene) {
        this.scene = scene;
        this.mapName = scene.mapName;
        this.busy = false;
        this.actors = [];
        this.solids = [];
        this.dialog = new StoryDialogUI(scene);
        this.shop = new ShopUI(scene);
        this.talkKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
        this.decor = scene.add.graphics().setDepth(4);

        this.setUpMap();
    }

    destroy() {
        this.destroyed = true;
        this.dialog.destroy();
        this.shop.destroy();
        this.decor.destroy();
        this.actors.forEach((actor) => actor.sprite.destroy());
        this.solids.forEach((solid) => solid.destroy());
    }

    /** True while a scene plays (dialogue, shop, battle started by a trainer). */
    isBusy() {
        return this.busy || this.dialog.isOpen() || this.shop.isOpen();
    }

    /*------------------------------------------------
    | Building the map's cast
    */

    setUpMap() {
        const style = interiorStyleFor(this.mapName);
        if (this.mapName === LAB) {
            this.setUpLab();
        } else if (style === "mart") {
            this.setUpMart();
        } else if (style === "gym") {
            this.setUpPewterGym();
        } else if (style === "museum") {
            this.setUpMuseum();
        }

        TRAINERS.filter((trainer) => trainer.map === this.mapName).forEach((trainer) => {
            this.addActor({
                ...trainer,
                onTalk: (actor) => (isTrainerDefeated(trainer.id) ? this.say(trainer.name, trainer.after) : this.trainerBattle(trainer, actor))
            });
        });
        PEOPLE.filter((person) => person.map === this.mapName).forEach((person) => {
            this.addActor({ ...person, onTalk: () => this.say(person.name, person.lines) });
        });
    }

    addActor({ id, name, sprite, tile, facing = "front", reach = 52, onTalk }) {
        const x = (tile.x * TILE) + 16;
        const feetY = (tile.y + 1) * TILE;
        const image = this.scene.add.image(x, feetY, CHARACTER_ATLAS, `${sprite}_${facing}.png`)
            .setOrigin(0.5, 1)
            .setDisplaySize(TILE, TILE * 2)
            .setDepth(5);
        const actor = { id, name, spriteKey: sprite, sprite: image, tile, x, feetY, reach, onTalk };
        this.actors.push(actor);
        this.addSolid(tile.x, tile.y);
        return actor;
    }

    removeActor(actor) {
        this.actors = this.actors.filter((entry) => entry !== actor);
        actor.sprite.destroy();
        const solid = this.solids.find((zone) => zone.tileX === actor.tile.x && zone.tileY === actor.tile.y);
        if (solid) {
            solid.destroy();
            this.solids = this.solids.filter((zone) => zone !== solid);
        }
    }

    // An invisible wall on one tile (people, counters, rocks...).
    addSolid(tileX, tileY) {
        const zone = this.scene.add.zone((tileX * TILE) + 16, (tileY * TILE) + 16, TILE, TILE);
        this.scene.physics.add.existing(zone, true);
        this.scene.physics.add.collider(this.scene.player, zone);
        zone.tileX = tileX;
        zone.tileY = tileY;
        this.solids.push(zone);
        return zone;
    }

    // Something to look at (a Poké Ball on the table, a fossil): talked to like a person.
    addThing({ id, tile, reach = 52, onTalk, solid = false }) {
        const actor = {
            id,
            tile,
            x: (tile.x * TILE) + 16,
            feetY: (tile.y + 1) * TILE,
            reach,
            onTalk,
            sprite: this.scene.add.container(0, 0)
        };
        this.actors.push(actor);
        if (solid) {
            this.addSolid(tile.x, tile.y);
        }
        return actor;
    }

    setUpLab() {
        const g = this.decor;
        // Table with the three Poké Balls
        g.fillStyle(0x8a5a32, 1).fillRect(5 * TILE, 3 * TILE + 8, 3 * TILE, TILE - 4);
        g.fillStyle(0xa86c3c, 1).fillRect(5 * TILE, 3 * TILE + 2, 3 * TILE, 14);
        [5, 6, 7].forEach((x) => this.addSolid(x, 3));

        const starter = this.starterId();
        const rivalStarter = starter ? RIVAL_STARTER[starter] : null;
        this.balls = STARTERS.map((choice) => {
            const ball = this.scene.add.graphics().setDepth(5);
            drawPokeBall(ball, (choice.ball.x * TILE) + 16, (choice.ball.y * TILE) + 8);
            const taken = choice.id === starter || choice.id === rivalStarter;
            ball.setVisible(!taken);
            const actor = this.addThing({ id: `ball-${choice.id}`, tile: choice.ball, reach: 46, onTalk: () => this.chooseStarter(choice) });
            actor.sprite.add(ball);
            return { choice, graphics: ball, actor };
        });

        this.professor = this.addActor({
            id: "professor",
            name: PROFESSOR_NAME,
            sprite: "professor",
            tile: { x: 3, y: 3 },
            onTalk: () => this.talkToProfessor()
        });

        if (!getStoryFlag("rivalBattle")) {
            this.rival = this.addActor({
                id: "rival",
                name: RIVAL_NAME,
                sprite: "bob",
                tile: { x: 7, y: 6 },
                facing: "left",
                onTalk: () => this.say(RIVAL_NAME, starter
                    ? ["Mon Pokémon est bien plus fort que le tien !"]
                    : ["Grand-père m'a promis un Pokémon à moi aussi.", "Allez, choisis vite, que je prenne le meilleur !"])
            });
        }

        if (!getStoryFlag("labIntro")) {
            this.run(() => this.labIntro());
        }
    }

    setUpMart() {
        const g = this.decor;
        // Counter on the left, shelves on the right
        g.fillStyle(0x4870b8, 1).fillRect(TILE, 4 * TILE + 4, 3 * TILE, TILE - 8);
        g.fillStyle(0xd8e4f4, 1).fillRect(TILE, 4 * TILE, 3 * TILE, 10);
        [1, 2, 3].forEach((x) => this.addSolid(x, 4));
        [[6, 3], [7, 3], [6, 6], [7, 6]].forEach(([x, y]) => {
            g.fillStyle(0x9a7048, 1).fillRect(x * TILE + 2, y * TILE - 14, TILE - 4, TILE + 12);
            ["0xe05050", "0x50a0e0", "0xe0c040"].forEach((color, i) => {
                g.fillStyle(Number(color), 1).fillRect(x * TILE + 5 + (i * 8), y * TILE - 8, 6, 8);
                g.fillStyle(Number(color), 1).fillRect(x * TILE + 5 + (i * 8), y * TILE + 8, 6, 8);
            });
            this.addSolid(x, y);
        });

        const town = this.mapName.split("@")[1];
        this.addActor({
            id: "clerk",
            name: "Vendeur",
            sprite: "tuxemartemployee",
            tile: { x: 2, y: 3 },
            reach: 84,
            onTalk: () => this.openShop(town)
        });
    }

    setUpPewterGym() {
        const g = this.decor;
        // Boulders, and the two statues at the entrance
        [[1, 3], [8, 3], [1, 7], [8, 6], [2, 6], [7, 2]].forEach(([x, y]) => {
            g.fillStyle(0x6a5a48, 1).fillEllipse(x * TILE + 16, y * TILE + 20, 30, 22);
            g.fillStyle(0x8a7a62, 1).fillEllipse(x * TILE + 13, y * TILE + 15, 18, 12);
            this.addSolid(x, y);
        });
        [3, 6].forEach((x) => {
            g.fillStyle(0x606870, 1).fillRect(x * TILE + 6, 7 * TILE + 8, 20, 22);
            g.fillStyle(0x9098a0, 1).fillRect(x * TILE + 9, 7 * TILE - 10, 14, 20);
            this.addSolid(x, 7);
            this.addThing({
                id: `statue-${x}`,
                tile: { x, y: 7 },
                onTalk: () => this.say("", getStoryFlag("badge1")
                    ? [`ARÈNE POKéMON D'ARGENTA`, `Champion : Pierre`, `Dresseurs vainqueurs : ${getTrainerName()}`]
                    : ["ARÈNE POKéMON D'ARGENTA", "Champion : Pierre", "Dresseurs vainqueurs : -"])
            });
        });
    }

    setUpMuseum() {
        const g = this.decor;
        const fossils = [
            { x: 2, name: "Amonita", text: "Un fossile d'Amonita, un Pokémon des mers préhistoriques." },
            { x: 4, name: "Kabuto", text: "Un fossile de Kabuto. Il vivait il y a 300 millions d'années." },
            { x: 6, name: "Ptéra", text: "Un squelette de Ptéra, un Pokémon volant disparu." }
        ];
        fossils.forEach(({ x, text }) => {
            g.fillStyle(0x8a6a48, 1).fillRect(x * TILE + 2, 3 * TILE + 6, TILE - 4, TILE - 8);
            g.fillStyle(0xd8d0c0, 1).fillCircle(x * TILE + 16, 3 * TILE + 2, 10);
            g.fillStyle(0xa89878, 1).fillCircle(x * TILE + 16, 3 * TILE + 2, 5);
            this.addSolid(x, 3);
            this.addThing({ id: `fossil-${x}`, tile: { x, y: 3 }, onTalk: () => this.say("", [text]) });
        });
    }

    /*------------------------------------------------
    | Every frame
    */

    update() {
        this.dialog.update();
        this.shop.update();
        this.updateDepths();

        if (this.busy || this.isBusy() || this.scene.isInterfaceOpen() || !this.scene.player) {
            return;
        }

        const feet = this.scene.player.getInteractionPoint();
        const tile = { x: Math.floor(feet.x / TILE), y: Math.floor(feet.y / TILE) };

        // No Pokémon yet: the Professor stops you at the edge of the tall grass.
        if (this.mapName === "town" && !this.starterId() && tile.y <= 3) {
            this.run(() => this.stopAtRouteOne());
            return;
        }

        // Trainers who see you come to battle.
        const spotter = TRAINERS.find((trainer) => trainer.map === this.mapName
            && trainer.sight
            && !isTrainerDefeated(trainer.id)
            && tile.x >= trainer.sight.x && tile.x < trainer.sight.x + trainer.sight.w
            && tile.y >= trainer.sight.y && tile.y < trainer.sight.y + trainer.sight.h);
        if (spotter && getParty().some((pokemon) => pokemon.stats.hp > 0)) {
            const actor = this.actors.find((entry) => entry.id === spotter.id);
            this.run(() => this.trainerBattle(spotter, actor, { spotted: true }));
            return;
        }

        if (Phaser.Input.Keyboard.JustDown(this.talkKey)) {
            const actor = this.nearestActor(feet);
            if (actor) {
                this.faceTowards(actor, feet);
                this.run(() => actor.onTalk(actor));
            }
        }
    }

    // People in front of the player are drawn over them, people behind under them.
    updateDepths() {
        const playerFeet = this.scene.player ? this.scene.player.y + 30 : 0;
        this.actors.forEach((actor) => {
            if (actor.sprite.setDepth) {
                actor.sprite.setDepth(actor.feetY > playerFeet ? 6 : 4);
            }
        });
    }

    nearestActor(feet) {
        let best = null;
        let bestDistance = Infinity;
        this.actors.forEach((actor) => {
            const distance = Phaser.Math.Distance.Between(feet.x, feet.y, actor.x, actor.feetY - 16);
            if (distance <= actor.reach && distance < bestDistance) {
                best = actor;
                bestDistance = distance;
            }
        });
        return best;
    }

    faceTowards(actor, point) {
        if (!actor.spriteKey) {
            return;
        }
        const dx = point.x - actor.x;
        const dy = point.y - (actor.feetY - 16);
        const facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "back" : "front");
        actor.sprite.setFrame(`${actor.spriteKey}_${facing}.png`);
    }

    async run(script) {
        if (this.busy) {
            return;
        }
        this.busy = true;
        this.scene.player?.body?.setVelocity(0);
        try {
            await script();
        } finally {
            this.busy = false;
            if (!this.destroyed) {
                this.scene.input.keyboard.resetKeys();
            }
        }
    }

    say(name, lines) {
        return this.destroyed ? Promise.resolve() : this.dialog.say(name, lines.map((line) => this.fill(line)));
    }

    ask(name, lines, choices) {
        return this.destroyed ? Promise.resolve(choices.length - 1) : this.dialog.ask(name, lines.map((line) => this.fill(line)), choices);
    }

    fill(line) {
        return String(line).replaceAll("{player}", getTrainerName()).replaceAll("{rival}", RIVAL_NAME);
    }

    wait(ms) {
        return new Promise((resolve) => this.scene.time.delayedCall(ms, resolve));
    }

    // The starter flag holds the chosen Pokémon's number.
    starterId() {
        return getStoryValue("starter") || null;
    }

    /*------------------------------------------------
    | Scenes
    */

    async stopAtRouteOne() {
        const player = this.scene.player;
        const professor = this.addActor({ id: "professor-outside", name: PROFESSOR_NAME, sprite: "professor", tile: { x: 13, y: 6 }, facing: "back" });
        await this.say(PROFESSOR_NAME, [
            "Attends ! Ne t'avance pas comme ça !",
            "Des Pokémon sauvages vivent dans les hautes herbes. Il te faut un Pokémon pour te protéger !",
            "Viens avec moi à mon labo, en bas à droite du bourg."
        ]);
        player.body.reset(448, 7 * TILE);
        player.setFacing("front");
        this.removeActor(professor);
    }

    async labIntro() {
        await this.wait(400);
        await this.say(PROFESSOR_NAME, [
            "Ah, {player} ! Te voilà enfin.",
            "Le monde est peuplé de créatures appelées Pokémon. Certains les aiment, d'autres les combattent...",
            "Sur cette table, il y a trois Poké Balls avec un Pokémon dans chacune.",
            "Tu peux en choisir un. Vas-y, prends-le !"
        ]);
        if (this.rival) {
            await this.say(RIVAL_NAME, ["Hé ! Grand-père ! Et moi alors ?"]);
            await this.say(PROFESSOR_NAME, ["Patience, {rival}. Tu choisiras après {player}."]);
        }
        setStoryFlag("labIntro");
    }

    async talkToProfessor() {
        if (!this.starterId()) {
            await this.say(PROFESSOR_NAME, ["Allez, {player}, choisis un Pokémon sur la table !"]);
            return;
        }
        if (getStoryFlag("badge1")) {
            await this.say(PROFESSOR_NAME, [
                "Le Badge Roche ! Tu as battu Pierre ? Bravo, {player} !",
                "Continue de remplir ton Pokédex. Le reste de Kanto t'attend !"
            ]);
            return;
        }
        await this.say(PROFESSOR_NAME, [
            "Remplis ton Pokédex en attrapant des Pokémon avec des Poké Balls.",
            "Va vers le nord : Jadielle, la Forêt de Jade, puis Argenta. Pierre, le Champion, t'y attend !"
        ]);
    }

    async chooseStarter(choice) {
        const starter = this.starterId();
        if (starter) {
            await this.say("", choice.id === starter || choice.id === RIVAL_STARTER[starter]
                ? ["La Poké Ball est vide."]
                : ["C'est le dernier Pokémon du Prof. Chen."]);
            return;
        }

        const answer = await this.ask(PROFESSOR_NAME, [`Tu veux ${choice.label}, le Pokémon ${choice.kind} ?`], ["Oui", "Non"]);
        if (answer !== 0) {
            return;
        }

        const pokemon = createBattlePokemonFromCatalog(choice.id, 5);
        givePokemon(pokemon);
        setStoryFlag("starter", choice.id);
        this.ballFor(choice.id).graphics.setVisible(false);
        await this.say("", [`{player} reçoit ${choice.label} !`]);

        const rivalChoice = STARTERS.find((entry) => entry.id === RIVAL_STARTER[choice.id]);
        if (this.rival) {
            await this.say(RIVAL_NAME, ["Alors moi, je prends celui-là !"]);
            this.ballFor(rivalChoice.id).graphics.setVisible(false);
            await this.say("", [`{rival} reçoit ${rivalChoice.label} !`]);
            await this.rivalBattle(rivalChoice);
        }
    }

    ballFor(id) {
        return this.balls.find((ball) => ball.choice.id === id);
    }

    async rivalBattle(rivalChoice) {
        await this.say(RIVAL_NAME, ["Attends, {player} ! On va voir lequel de nos Pokémon est le plus fort !"]);
        const result = await this.scene.battleUi.startTrainerBattle({
            name: RIVAL_NAME,
            party: [{ id: rivalChoice.id, level: 5 }],
            prize: 70,
            allowLoss: true,
            defeatText: "Quoi ?! J'ai pris le mauvais Pokémon !"
        });
        if (this.destroyed) {
            return;
        }

        await this.say(RIVAL_NAME, result.won
            ? ["Bon, j'irai entraîner mon Pokémon. Salut, {player} !"]
            : ["Ha ! Mon Pokémon est le meilleur ! Allez, salut !"]);
        setStoryFlag("rivalBattle");
        healParty();
        if (this.rival) {
            this.removeActor(this.rival);
            this.rival = null;
        }

        await this.say(PROFESSOR_NAME, [
            "Ton Pokémon s'est bien battu. Je l'ai soigné.",
            "Tiens, prends aussi ces Poké Balls. Elles servent à attraper les Pokémon sauvages."
        ]);
        addBagItem("poke-ball", 5);
        await this.say("", ["{player} reçoit 5 Poké Balls !"]);
        await this.say(PROFESSOR_NAME, [
            "Affaiblis un Pokémon sauvage, puis lance une Poké Ball depuis le SAC.",
            "Va vers le nord : Jadielle, la Forêt de Jade, puis Argenta. Pierre, le Champion, t'y attend !"
        ]);
    }

    async trainerBattle(trainer, actor, { spotted = false } = {}) {
        if (spotted && actor) {
            await this.exclaim(actor);
        }
        await this.say(trainer.name, trainer.intro);
        const result = await this.scene.battleUi.startTrainerBattle({
            name: trainer.name,
            party: trainer.party,
            prize: trainer.prize,
            defeatText: trainer.defeatText
        });
        if (this.destroyed || !result.won) {
            return;
        }
        markTrainerDefeated(trainer.id);

        if (trainer.badge) {
            earnBadge(trainer.badge);
            setStoryFlag(`badge${trainer.badge}`);
            await this.say("", ["{player} reçoit le Badge Roche de Pierre !"]);
            await this.say(trainer.name, trainer.reward);
        }
    }

    async exclaim(actor) {
        const bubble = this.scene.add.text(actor.x, actor.feetY - 70, "!", {
            fontFamily: FONT_FAMILY,
            fontSize: "14px",
            color: "#e03030",
            backgroundColor: "#ffffff",
            padding: { x: 6, y: 3 }
        }).setOrigin(0.5, 1).setDepth(50);
        await this.wait(700);
        bubble.destroy();
    }

    async openShop(town) {
        const answer = await this.ask("Vendeur", ["Bienvenue ! Que puis-je faire pour toi ?"], ["Acheter", "Au revoir"]);
        if (answer !== 0) {
            await this.say("Vendeur", ["À bientôt !"]);
            return;
        }
        await this.shop.open(SHOPS[town] || SHOPS.viridian, {
            onMessage: (message) => this.dialog.say("Vendeur", [message])
        });
        await this.say("Vendeur", ["Merci, et à bientôt !"]);
    }
}

function drawPokeBall(g, x, y) {
    g.fillStyle(0x303030, 1).fillCircle(x, y, 9);
    g.fillStyle(0xe03030, 1).fillCircle(x, y, 8);
    g.fillStyle(0xf8f8f8, 1);
    g.slice(x, y, 8, 0, Math.PI, false);
    g.fillPath();
    g.fillStyle(0x303030, 1).fillRect(x - 8, y - 1, 16, 2);
    g.fillStyle(0xf8f8f8, 1).fillCircle(x, y, 3);
    g.lineStyle(1, 0x303030, 1).strokeCircle(x, y, 3);
}
