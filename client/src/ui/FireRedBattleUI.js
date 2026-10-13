import Phaser from "phaser";
import {
    addMoney,
    applyExperience,
    createBattlePokemonFromCatalog,
    experienceProgress,
    experienceReward,
    getBag,
    getBattleReadyParty,
    getMoney,
    getParty,
    getWhiteoutDestination,
    givePokemon,
    healParty,
    markPokemonCaught,
    removeBagItem,
    useBagItem,
    getFirstAvailablePartyIndex,
    getTrainerName,
    markPokemonSeen,
    updateParty
} from "../state/gameState";
import { statusLabel, typeLabel } from "../i18n";
import { VIEW } from "./theme";
import { artKey, loadPokemonArt } from "../pokemonArt";

const FONT_FAMILY = "\"Press Start 2P\"";
const TYPE_COLORS = {
    Fire: "#f83800",
    Water: "#6890f0",
    Grass: "#78c850",
    Electric: "#f8d030",
    Psychic: "#f85888",
    Ice: "#98d8d8",
    Fighting: "#c03028",
    Poison: "#a040a0",
    Ground: "#e0c068",
    Flying: "#a890f0",
    Bug: "#a8b820",
    Rock: "#b8a038",
    Ghost: "#705898",
    Dragon: "#7038f8",
    Dark: "#705848",
    Steel: "#b8b8d0",
    Normal: "#a8a878"
};
const COLORS = {
    fieldBackground: 0xe8f0d8,
    panelBackground: 0xf0f0e0,
    panelBorder: 0x303848,
    panelShadow: 0xc0c0b0,
    text: "#2c2c2c",
    cursor: "#3a3830",
    hpGreen: 0x48d848,
    hpYellow: 0xf8d800,
    hpRed: 0xf83800,
    hpBackground: 0xa0a0a0,
    enemyPlatform: 0xbfd6a5,
    playerPlatform: 0xa8c890,
    flash: 0xffffff
};
const COMMANDS = [
    { id: "FIGHT", label: "ATTAQUE" },
    { id: "BAG", label: "SAC" },
    { id: "POKEMON", label: "POKÉMON" },
    { id: "RUN", label: "FUITE" }
];
const LAYOUT = {
    // Opponent's box top left, as in the recent games, so it never hides the opponent.
    enemyHud: { x: 0.05, y: 0.06, width: 0.3, height: 0.15 },
    enemySlot: { x: 0.79, y: 0.40, platformWidth: 0.23, platformHeight: 0.09 },
    playerSlot: { x: 0.26, y: 0.66, platformWidth: 0.28, platformHeight: 0.10 },
    // above the text box (it used to be hidden under it)
    playerHud: { x: 0.6, y: 0.475, width: 0.34, height: 0.205 },
    messagePanel: { x: 16, y: 310, height: 124 },
    commandPanel: { width: 242, height: 124, margin: 16 },
    partyPanel: { x: 64, y: 48, width: 672, height: 340 }
};
// Largest size of a Pokémon in battle; smaller species are shown smaller (see fitSprite).
const BATTLE_SPRITE_BOUNDS = {
    enemy: { maxWidth: 170, maxHeight: 150 },
    player: { maxWidth: 215, maxHeight: 180 }
};
const DAMAGE_VARIANCE_MIN = 0.85;
const DAMAGE_VARIANCE_MAX = 1;
const STAB_MULTIPLIER = 1.5;
const NEUTRAL_EFFECTIVENESS = 1;
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

export default class FireRedBattleUI {
    constructor(scene) {
        this.scene = scene;
        this.visible = false;
        this.phase = "hidden";
        this.commandIndex = 0;
        this.moveIndex = 0;
        this.switchIndex = 0;
        this.messageQueue = [];
        this.messagePage = 0;
        this.currentLogMessage = "";
        this.battle = null;
        this.animationQueue = new BattleAnimationQueue();

        this.keys = this.scene.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.UP,
            down: Phaser.Input.Keyboard.KeyCodes.DOWN,
            left: Phaser.Input.Keyboard.KeyCodes.LEFT,
            right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
            w: Phaser.Input.Keyboard.KeyCodes.W,
            s: Phaser.Input.Keyboard.KeyCodes.S,
            a: Phaser.Input.Keyboard.KeyCodes.A,
            d: Phaser.Input.Keyboard.KeyCodes.D,
            enter: Phaser.Input.Keyboard.KeyCodes.ENTER,
            z: Phaser.Input.Keyboard.KeyCodes.Z,
            escape: Phaser.Input.Keyboard.KeyCodes.ESC,
            x: Phaser.Input.Keyboard.KeyCodes.X
        });

        this.createUi();
        this.createTouchTargets();
        this.blinkVisible = true;
        this.blinkEvent = this.scene.time.addEvent({
            delay: 500,
            loop: true,
            callback: () => {
                this.blinkVisible = !this.blinkVisible;
                this.refreshCursor();
            }
        });
    }

    destroy() {
        if (this.blinkEvent) {
            this.blinkEvent.remove();
        }

        this.root.destroy(true);
    }

    isOpen() {
        return this.visible;
    }

    async tryStartEncounter(encounter) {
        const party = getBattleReadyParty();
        const activePartyIndex = getFirstAvailablePartyIndex(party);
        if (activePartyIndex < 0 || !encounter?.pokemonId || !encounter?.level) {
            return false;
        }

        const wildPokemon = createBattlePokemonFromCatalog(encounter.pokemonId, encounter.level);
        if (!wildPokemon) {
            return false;
        }

        markPokemonSeen(wildPokemon.id);

        await this.loadArt(wildPokemon);
        await this.loadArt(party[activePartyIndex]);

        this.battle = {
            party,
            activePartyIndex,
            wildPokemon,
            trainer: null,
            trainerName: getTrainerName()
        };
        this.resolveBattle = null;
        this.visible = true;
        this.phase = "message";
        this.commandIndex = 0;
        this.moveIndex = 0;
        this.switchIndex = 0;
        this.root.setVisible(true);
        this.resetVisualState();
        this.refreshBattleView(true);
        this.setMessages([
            `Un ${wildPokemon.name} sauvage apparaît !`,
            `Go ! ${party[activePartyIndex].name} !`
        ]);
        return true;
    }

    /**
     * Battle against a trainer: their Pokémon one after the other, no running, no catching.
     * Resolves with { won } once the battle screen closes. Losing sends the player back to
     * the last Pokémon Center, unless allowLoss (the first battle against the rival).
     */
    async startTrainerBattle({ name, party: enemyTeam, prize = 0, allowLoss = false, defeatText = "" }) {
        const party = getBattleReadyParty();
        const activePartyIndex = getFirstAvailablePartyIndex(party);
        const enemies = enemyTeam.map(({ id, level }) => createBattlePokemonFromCatalog(id, level)).filter(Boolean);
        if (activePartyIndex < 0 || !enemies.length) {
            return { won: false, skipped: true };
        }

        for (const enemy of enemies) {
            markPokemonSeen(enemy.id);
            await this.loadArt(enemy);
        }
        await this.loadArt(party[activePartyIndex]);

        this.battle = {
            party,
            activePartyIndex,
            wildPokemon: enemies[0],
            trainer: { name, enemies, index: 0, prize, allowLoss, defeatText },
            trainerName: getTrainerName()
        };
        this.visible = true;
        this.phase = "message";
        this.commandIndex = 0;
        this.moveIndex = 0;
        this.switchIndex = 0;
        this.root.setVisible(true);
        this.resetVisualState();
        this.refreshBattleView(true);
        this.setMessages([
            `${name} veut se battre !`,
            `${name} envoie ${enemies[0].name} !`,
            `Go ! ${party[activePartyIndex].name} !`
        ]);

        return new Promise((resolve) => {
            this.resolveBattle = resolve;
        });
    }

    update() {
        if (!this.visible || !this.battle) {
            return;
        }

        if (this.phase === "message") {
            if (this.isConfirmPressed() || this.isCancelPressed()) {
                this.advanceMessage();
            }
            return;
        }

        if (this.phase === "busy" || this.animationQueue.isRunning()) {
            return;
        }

        if (this.phase === "command") {
            this.handleCommandInput();
            return;
        }

        if (this.phase === "moves") {
            this.handleMoveInput();
            return;
        }

        if (this.phase === "party") {
            this.handlePartyInput();
            return;
        }

        if (this.phase === "bag") {
            this.handleBagInput();
        }
    }

    createUi() {
        const width = VIEW.width;
        const height = VIEW.height;
        const commandX = width - LAYOUT.commandPanel.width - LAYOUT.commandPanel.margin;
        const messageWidth = commandX - (LAYOUT.messagePanel.x * 2);

        this.root = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(1200).setVisible(false);

        this.background = this.scene.add.graphics();
        this.background.fillGradientStyle(0x9fd8f8, 0x9fd8f8, 0xd8f0c0, 0xd8f0c0, 1);
        this.background.fillRect(0, 0, width, height * 0.55);
        this.background.fillGradientStyle(0xc8e8a0, 0xc8e8a0, 0x98cc78, 0x98cc78, 1);
        this.background.fillRect(0, height * 0.55, width, height * 0.45);
        this.flashOverlay = this.scene.add.rectangle(0, 0, width, height, COLORS.flash).setOrigin(0).setAlpha(0);
        this.typeOverlay = this.scene.add.rectangle(0, 0, width, height, COLORS.flash).setOrigin(0).setAlpha(0);

        this.enemySlot = this.createSpriteSlot("enemy", width * LAYOUT.enemySlot.x, height * LAYOUT.enemySlot.y, width * LAYOUT.enemySlot.platformWidth, height * LAYOUT.enemySlot.platformHeight, COLORS.enemyPlatform);
        this.playerSlot = this.createSpriteSlot("player", width * LAYOUT.playerSlot.x, height * LAYOUT.playerSlot.y, width * LAYOUT.playerSlot.platformWidth, height * LAYOUT.playerSlot.platformHeight, COLORS.playerPlatform);

        this.enemyInfo = this.createStatusPanel(width * LAYOUT.enemyHud.x, height * LAYOUT.enemyHud.y, width * LAYOUT.enemyHud.width, height * LAYOUT.enemyHud.height, false);
        this.playerInfo = this.createStatusPanel(width * LAYOUT.playerHud.x, height * LAYOUT.playerHud.y, width * LAYOUT.playerHud.width, height * LAYOUT.playerHud.height, true);

        this.messagePanel = this.createPanel(LAYOUT.messagePanel.x, LAYOUT.messagePanel.y, messageWidth, LAYOUT.messagePanel.height);
        this.messageLines = [
            this.createText(LAYOUT.messagePanel.x + 18, LAYOUT.messagePanel.y + 18, "", 10),
            this.createText(LAYOUT.messagePanel.x + 18, LAYOUT.messagePanel.y + 46, "", 10),
            this.createText(LAYOUT.messagePanel.x + 18, LAYOUT.messagePanel.y + 74, "", 10)
        ];
        this.messageCursor = this.createText(LAYOUT.messagePanel.x + messageWidth - 18, LAYOUT.messagePanel.y + LAYOUT.messagePanel.height - 26, "▼", 10, "#e03030").setOrigin(1, 0);

        this.commandPanel = this.createPanel(commandX, LAYOUT.messagePanel.y, LAYOUT.commandPanel.width, LAYOUT.commandPanel.height);
        this.commandCursor = this.createText(commandX + 16, LAYOUT.messagePanel.y + 42, "►", 10, COLORS.cursor);
        this.commandLabels = COMMANDS.map((command, index) => this.createText(
            commandX + 40 + ((index % 2) * 104),
            LAYOUT.messagePanel.y + 42 + (Math.floor(index / 2) * 32),
            command.label,
            9
        ));

        this.movePanel = this.createPanel(commandX, LAYOUT.messagePanel.y, LAYOUT.commandPanel.width, LAYOUT.commandPanel.height);
        this.movePanel.setVisible(false);
        this.moveCursor = this.createText(commandX + 16, LAYOUT.messagePanel.y + 24, "►", 10, COLORS.cursor);
        this.moveLabels = Array.from({ length: 4 }, (_, index) => this.createText(commandX + 40, LAYOUT.messagePanel.y + 24 + (index * 22), "", 8));

        this.partyPanel = this.createPanel(LAYOUT.partyPanel.x, LAYOUT.partyPanel.y, LAYOUT.partyPanel.width, LAYOUT.partyPanel.height);
        this.partyPanel.setVisible(false);
        this.partyTitle = this.createText(LAYOUT.partyPanel.x + 18, LAYOUT.partyPanel.y + 18, "CHOISIS UN POKÉMON", 10);
        this.partyCursor = this.createText(LAYOUT.partyPanel.x + 20, LAYOUT.partyPanel.y + 62, "►", 10, COLORS.cursor);
        this.partyEntryLabels = Array.from({ length: 6 }, (_, index) => this.createText(
            LAYOUT.partyPanel.x + 44,
            LAYOUT.partyPanel.y + 62 + (index * 40),
            "",
            8
        ));
        this.partyFooter = this.createText(LAYOUT.partyPanel.x + 18, LAYOUT.partyPanel.y + LAYOUT.partyPanel.height - 30, "X / ÉCHAP : RETOUR", 8, COLORS.cursor);

        [
            this.background,
            this.enemySlot.platform,
            this.playerSlot.platform,
            this.enemySlot.sprite,
            this.playerSlot.sprite,
            this.flashOverlay,
            this.typeOverlay,
            this.enemyInfo.container,
            this.playerInfo.container,
            this.messagePanel,
            ...this.messageLines,
            this.messageCursor,
            this.commandPanel,
            this.commandCursor,
            ...this.commandLabels,
            this.movePanel,
            this.moveCursor,
            ...this.moveLabels,
            this.partyPanel,
            this.partyTitle,
            this.partyCursor,
            ...this.partyEntryLabels,
            this.partyFooter
        ].forEach((child) => this.root.add(child));
    }

    /*
     * Tap support for phones: tapping a command, a move, a Pokémon or the
     * message box does the same as moving the cursor there and pressing A.
     */
    createTouchTargets() {
        const width = VIEW.width;
        const commandX = width - LAYOUT.commandPanel.width - LAYOUT.commandPanel.margin;
        const zone = (x, y, w, h, onTap) => {
            // scrollFactor 0 on the object itself, so taps line up while the camera follows the player
            const target = this.scene.add.rectangle(x, y, w, h, 0xffffff, 0.001)
                .setOrigin(0)
                .setScrollFactor(0)
                .setInteractive()
                .on("pointerdown", () => {
                    if (this.visible) {
                        onTap();
                    }
                });
            this.root.add(target);
            return target;
        };

        // Message box: next message
        this.touchMessageZone = zone(LAYOUT.messagePanel.x, LAYOUT.messagePanel.y, commandX - (LAYOUT.messagePanel.x * 2), LAYOUT.messagePanel.height, () => {
            if (this.phase === "message") {
                this.pendingTouchConfirm = true;
            }
        });

        // FIGHT / BAG / POKÉMON / RUN (2 x 2 grid)
        this.touchCommandZones = COMMANDS.map((command, index) => zone(
            commandX + 8 + ((index % 2) * 116),
            LAYOUT.messagePanel.y + 26 + (Math.floor(index / 2) * 40),
            112,
            38,
            () => {
                if (this.phase === "command") {
                    this.commandIndex = index;
                    this.pendingTouchConfirm = true;
                }
            }
        ));

        // Moves (4 rows)
        this.touchMoveZones = Array.from({ length: 4 }, (_, index) => zone(
            commandX + 4,
            LAYOUT.messagePanel.y + 14 + (index * 22),
            LAYOUT.commandPanel.width - 8,
            22,
            () => {
                if (this.phase === "moves" && this.battle?.party[this.battle.activePartyIndex]?.moves[index]) {
                    this.moveIndex = index;
                    this.pendingTouchConfirm = true;
                }
            }
        ));

        // Party (6 rows)
        this.touchPartyZones = Array.from({ length: 6 }, (_, index) => zone(
            LAYOUT.partyPanel.x + 8,
            LAYOUT.partyPanel.y + 52 + (index * 40),
            LAYOUT.partyPanel.width - 16,
            38,
            () => {
                if (this.phase === "party" && this.battle?.party[index]) {
                    this.switchIndex = index;
                    this.pendingTouchConfirm = true;
                } else if (this.phase === "bag" && this.battle?.bagItems?.[index]) {
                    this.bagIndex = index;
                    this.pendingTouchConfirm = true;
                }
            }
        ));
    }

    createSpriteSlot(side, x, y, platformWidth, platformHeight, platformColor) {
        const platform = this.scene.add.ellipse(x, y, platformWidth, platformHeight, platformColor).setAlpha(1);
        const sprite = this.scene.add.image(x, y - 8, "currentPlayer", side === "player" ? "misa-back" : "misa-front")
            .setOrigin(0.5, 1)
            .setVisible(false);

        return {
            side,
            platform,
            sprite,
            baseX: x,
            baseY: y - 8,
            basePlatformAlpha: 1,
            baseSpriteAlpha: 1
        };
    }

    createStatusPanel(x, y, width, height, showHpValue) {
        const container = this.scene.add.container(x, y);
        const box = this.scene.add.graphics();
        box.fillStyle(0x000000, 0.18).fillRoundedRect(3, 5, width, height, 12);
        box.fillStyle(0xffffff, 0.94).fillRoundedRect(0, 0, width, height, 12);
        box.lineStyle(2, 0x5a7088, 1).strokeRoundedRect(0, 0, width, height, 12);
        const name = this.createText(14, 8, "", 10);
        const level = this.createText(width - 14, 10, "", 8).setOrigin(1, 0);
        const barY = showHpValue ? 40 : height - 18;
        const hpLabel = this.createText(14, barY - 9, "PV", 7, "#e07020");
        const hpValue = this.createText(width - 14, barY + 8, "", 8).setOrigin(1, 0).setVisible(showHpValue);
        const hpBarBackground = this.scene.add.rectangle(44, barY, width - 58, 8, 0x485868).setOrigin(0, 0.5);
        const hpBarFill = this.scene.add.rectangle(44, barY, width - 58, 8, COLORS.hpGreen).setOrigin(0, 0.5);

        container.add([box, name, level, hpLabel, hpValue, hpBarBackground, hpBarFill]);

        // Your own Pokémon also shows its EXP bar, under the HP.
        let expBarFill = null;
        if (showHpValue) {
            const expLabel = this.createText(14, height - 17, "EXP", 5, "#2878c8");
            const expBarBackground = this.scene.add.rectangle(44, height - 10, width - 58, 5, 0xc8d0d8).setOrigin(0, 0.5);
            expBarFill = this.scene.add.rectangle(44, height - 10, width - 58, 5, 0x48a0f0).setOrigin(0, 0.5);
            container.add([expLabel, expBarBackground, expBarFill]);
        }
        return {
            expBarFill,
            container,
            width,
            height,
            showHpValue,
            name,
            level,
            hpLabel,
            hpValue,
            hpBarBackground,
            hpBarFill,
            barWidth: width - 58,
            renderedHp: 0
        };
    }

    createPanel(x, y, width, height) {
        const container = this.scene.add.container(x, y);
        const box = this.scene.add.graphics();
        box.fillStyle(0x000000, 0.2).fillRoundedRect(3, 5, width, height, 14);
        box.fillStyle(0xffffff, 0.96).fillRoundedRect(0, 0, width, height, 14);
        box.lineStyle(3, 0x5a7088, 1).strokeRoundedRect(0, 0, width, height, 14);
        container.add(box);
        return container;
    }

    createText(x, y, value, size, color = COLORS.text) {
        return this.scene.add.text(x, y, value, {
            fontFamily: FONT_FAMILY,
            fontSize: `${size}px`,
            color
        });
    }

    setMessages(messages) {
        this.messageQueue = messages.filter(Boolean);
        this.messagePage = 0;
        this.phase = "message";
        this.refreshMessage();
        this.refreshBattleView();
    }

    advanceMessage() {
        this.messagePage += 1;
        if (this.messagePage >= this.messageQueue.length) {
            this.messageQueue = [];
            this.messagePage = 0;

            if (this.shouldCloseAfterMessages()) {
                this.endBattle();
                return;
            }

            this.phase = "command";
            this.refreshBattleView(true);
            return;
        }

        this.refreshMessage();
    }

    shouldCloseAfterMessages() {
        if (!this.battle) {
            return true;
        }

        const playerHasPokemon = getFirstAvailablePartyIndex(this.battle.party) >= 0;
        const wildAlive = this.battle.wildPokemon.stats.hp > 0;
        return !playerHasPokemon || !wildAlive || this.battle.finished;
    }

    refreshBattleView(resetSprites = false) {
        if (!this.battle) {
            return;
        }

        const activePokemon = this.battle.party[this.battle.activePartyIndex];
        this.root.setVisible(true);
        this.syncSlotVisual(this.enemySlot, this.battle.wildPokemon, artKey(this.battle.wildPokemon.id), "enemy");
        this.syncSlotVisual(this.playerSlot, activePokemon, artKey(activePokemon.id), "player");

        if (resetSprites) {
            this.resetVisualState();
        }

        this.renderStatus(this.enemyInfo, this.battle.wildPokemon);
        this.renderStatus(this.playerInfo, activePokemon);

        const showCommand = this.phase === "command";
        this.commandPanel.setVisible(showCommand);
        this.commandCursor.setVisible(showCommand && this.blinkVisible);
        this.commandLabels.forEach((label, index) => {
            label.setVisible(showCommand);
            label.setColor(index === this.commandIndex ? COLORS.cursor : COLORS.text);
        });

        const showMoves = this.phase === "moves";
        this.movePanel.setVisible(showMoves);
        this.moveCursor.setVisible(showMoves && this.blinkVisible);
        this.moveLabels.forEach((label, index) => {
            const move = activePokemon.moves[index];
            label.setVisible(showMoves);
            label.setText(move ? `${move.displayName} ${move.currentPp}/${move.maxPp}` : "");
            label.setColor(move ? this.getMoveTextColor(move) : COLORS.text);
        });

        // The same list panel shows the team, or the bag.
        const showBag = this.phase === "bag";
        const showParty = this.phase === "party" || showBag;
        this.partyPanel.setVisible(showParty);
        this.partyTitle.setVisible(showParty);
        this.partyTitle.setText(showBag ? "SAC" : "CHOISIS UN POKÉMON");
        this.partyCursor.setVisible(showParty && this.blinkVisible);
        this.partyFooter.setVisible(showParty);
        this.partyEntryLabels.forEach((label, index) => {
            label.setVisible(showParty);
            if (showBag) {
                const item = (this.battle.bagItems || [])[index];
                label.setText(item ? `${item.name}  x${item.quantity}` : "");
                label.setColor(index === this.bagIndex ? COLORS.cursor : COLORS.text);
                return;
            }
            const pokemon = this.battle.party[index];
            label.setText(pokemon ? `${pokemon.name} N.${pokemon.level} PV ${pokemon.stats.hp}/${pokemon.stats.maxHp}` : "");
            label.setColor(index === this.switchIndex ? COLORS.cursor : pokemon?.stats.hp > 0 ? COLORS.text : "#8a8a8a");
        });

        this.refreshMessage();
        this.refreshCursor();
        this.syncTouchTargets();
    }

    // Only the tap zones of the current step are active (some overlap on screen).
    syncTouchTargets() {
        if (!this.touchCommandZones) {
            return;
        }
        this.touchMessageZone.setVisible(this.phase === "message");
        this.touchCommandZones.forEach((zone) => zone.setVisible(this.phase === "command"));
        this.touchMoveZones.forEach((zone) => zone.setVisible(this.phase === "moves"));
        this.touchPartyZones.forEach((zone) => zone.setVisible(this.phase === "party" || this.phase === "bag"));
    }

    syncSlotVisual(slot, pokemon, textureKey, boundsKey) {
        slot.sprite.setVisible(Boolean(pokemon));
        slot.platform.setVisible(Boolean(pokemon));

        if (!pokemon) {
            return;
        }

        if (slot.sprite.texture?.key !== textureKey && this.scene.textures.exists(textureKey)) {
            slot.sprite.setTexture(textureKey);
        }
        // No picture could be loaded: show nothing rather than the placeholder character.
        if (slot.sprite.texture?.key !== textureKey) {
            slot.sprite.setVisible(false);
        }

        slot.sprite.setFlipX(slot.side === "player");
        fitSprite(slot.sprite, BATTLE_SPRITE_BOUNDS[boundsKey], pokemon);
        slot.sprite.setPosition(slot.baseX, slot.baseY);
        slot.platform.setPosition(slot.baseX, slot.side === "enemy" ? VIEW.height * LAYOUT.enemySlot.y : VIEW.height * LAYOUT.playerSlot.y);
        slot.sprite.clearTint();
        slot.sprite.setAlpha(pokemon.stats.hp > 0 ? 1 : 0);
        slot.platform.setAlpha(pokemon.stats.hp > 0 ? 1 : 0);
    }

    renderStatus(panel, pokemon, hpOverride = pokemon.stats.hp) {
        const hp = clamp(Math.round(hpOverride), 0, pokemon.stats.maxHp);
        const hpPercent = pokemon.stats.maxHp > 0 ? hp / pokemon.stats.maxHp : 0;

        panel.name.setText(pokemon.name);
        panel.level.setText(`N.${pokemon.level}`);
        panel.renderedHp = hp;

        if (panel.showHpValue) {
            panel.hpValue.setText(`${hp}/${pokemon.stats.maxHp}`);
        } else {
            panel.hpValue.setText(`${Math.round(hpPercent * 100)}%`);
        }

        const barWidth = Math.max(0, Math.round(panel.barWidth * hpPercent));
        const hpColor = getHpColor(hpPercent);
        panel.hpBarFill.width = barWidth;
        panel.hpBarFill.setFillStyle(hpColor);

        // While experience is being gained, gainExperience() animates the bar itself.
        if (panel.expBarFill && !panel.animatingExp) {
            panel.expBarFill.width = Math.round(panel.barWidth * experienceProgress(pokemon));
        }
    }

    refreshMessage() {
        let currentMessage = this.messageQueue.length
            ? this.messageQueue[this.messagePage] || ""
            : this.currentLogMessage;
        if (this.phase === "command" && this.battle) {
            currentMessage = `Que doit faire ${this.battle.party[this.battle.activePartyIndex].name} ?`;
        }
        // Choosing an attack: its PP and type, as in the games.
        if (this.phase === "moves" && this.battle) {
            const move = this.battle.party[this.battle.activePartyIndex].moves[this.moveIndex];
            if (move) {
                currentMessage = `${move.displayName} · PP ${move.currentPp}/${move.maxPp} · Type ${typeLabel(move.type)}`;
            }
        }
        const wrapped = wrapMessage(currentMessage, 46, 3);
        this.messageLines.forEach((line, index) => {
            line.setText(wrapped[index] || "");
        });
    }

    refreshCursor() {
        if (!this.visible) {
            return;
        }

        const width = VIEW.width;
        const commandX = width - LAYOUT.commandPanel.width - LAYOUT.commandPanel.margin;

        this.messageCursor.setVisible(this.blinkVisible && this.visible && this.phase === "message");
        if (this.phase === "command") {
            this.commandCursor.setVisible(this.blinkVisible);
            this.commandCursor.setPosition(commandX + 16 + ((this.commandIndex % 2) * 104), LAYOUT.messagePanel.y + 42 + (Math.floor(this.commandIndex / 2) * 32));
        } else if (this.phase === "moves") {
            this.moveCursor.setVisible(this.blinkVisible);
            this.moveCursor.setPosition(commandX + 16, LAYOUT.messagePanel.y + 24 + (this.moveIndex * 22));
        } else if (this.phase === "party" || this.phase === "bag") {
            const row = this.phase === "bag" ? this.bagIndex : this.switchIndex;
            this.partyCursor.setVisible(this.blinkVisible);
            this.partyCursor.setPosition(LAYOUT.partyPanel.x + 20, LAYOUT.partyPanel.y + 62 + (row * 40));
        }
    }

    handleCommandInput() {
        if (this.isUpPressed()) {
            this.commandIndex = Phaser.Math.Wrap(this.commandIndex - 2, 0, COMMANDS.length);
            this.refreshBattleView();
            return;
        }

        if (this.isDownPressed()) {
            this.commandIndex = Phaser.Math.Wrap(this.commandIndex + 2, 0, COMMANDS.length);
            this.refreshBattleView();
            return;
        }

        if (this.isLeftPressed()) {
            this.commandIndex = Phaser.Math.Wrap(this.commandIndex - 1, 0, COMMANDS.length);
            this.refreshBattleView();
            return;
        }

        if (this.isRightPressed()) {
            this.commandIndex = Phaser.Math.Wrap(this.commandIndex + 1, 0, COMMANDS.length);
            this.refreshBattleView();
            return;
        }

        if (this.isConfirmPressed()) {
            this.activateCommand(COMMANDS[this.commandIndex].id);
        }
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
            if (this.battle.trainer) {
                this.setMessages(["Impossible de fuir un combat de dresseur !"]);
                return;
            }
            this.battle.finished = true;
            this.currentLogMessage = "Vous prenez la fuite !";
            this.enterFinalMessagePhase();
            return;
        }

        this.battle.bagItems = this.getBattleItems();
        if (!this.battle.bagItems.length) {
            this.setMessages(["Aucun objet utilisable ici."]);
            return;
        }
        this.bagIndex = 0;
        this.phase = "bag";
        this.refreshBattleView();
    }

    // Potions and status heals for the Pokémon in battle, Poké Balls against wild Pokémon.
    getBattleItems() {
        const bag = getBag();
        const usable = (item) => {
            const type = item.effect?.type;
            if (type === "capture") {
                return !this.battle.trainer;
            }
            return type === "heal_hp" || type === "heal_status" || type === "revive";
        };
        return Object.values(bag).flat().filter((item) => item.quantity > 0 && usable(item));
    }

    handleBagInput() {
        const items = this.battle.bagItems || [];
        if (this.isCancelPressed()) {
            this.phase = "command";
            this.refreshBattleView();
            return;
        }
        if (this.isUpPressed()) {
            this.bagIndex = Phaser.Math.Wrap(this.bagIndex - 1, 0, items.length);
            this.refreshBattleView();
            return;
        }
        if (this.isDownPressed()) {
            this.bagIndex = Phaser.Math.Wrap(this.bagIndex + 1, 0, items.length);
            this.refreshBattleView();
            return;
        }
        if (this.isConfirmPressed() && items[this.bagIndex]) {
            this.useBattleItem(items[this.bagIndex]);
        }
    }

    async useBattleItem(item) {
        this.phase = "busy";
        this.refreshBattleView();

        if (item.effect.type === "capture") {
            await this.throwBall(item);
            return;
        }

        // Items work on the saved team: save the battle's state first, then read it back.
        this.syncPartyState();
        const index = this.battle.activePartyIndex;
        const result = useBagItem(item.id, index);
        if (!result.success) {
            this.phase = "command";
            this.setMessages([result.message]);
            return;
        }
        const healed = getParty()[index];
        const pokemon = this.battle.party[index];
        const hpBefore = pokemon.stats.hp;
        pokemon.stats = { ...pokemon.stats, hp: healed.stats.hp };
        pokemon.status = healed.status;
        await this.showBattleLog(`${getTrainerName()} utilise ${item.name} !`, 400);
        await this.animateHpBar(this.playerInfo, pokemon, hpBefore, pokemon.stats.hp);
        await this.showBattleLog(result.message, 500);
        // Using an item takes the turn: the opponent attacks.
        this.phase = "command";
        this.resolveTurn(null);
    }

    async throwBall(item) {
        removeBagItem(item.id, 1);
        const target = this.battle.wildPokemon;
        await this.showBattleLog(`${getTrainerName()} lance une ${item.name} !`, 400);

        // Easier on a weakened Pokémon; a Super Ball does better.
        const ballBonus = item.id === "great-ball" ? 1.5 : 1;
        const hpFactor = ((3 * target.stats.maxHp) - (2 * target.stats.hp)) / (3 * target.stats.maxHp);
        const chance = clamp(hpFactor * 0.75 * ballBonus + 0.08, 0.05, 0.95);
        const sprite = this.enemySlot.sprite;

        await this.tween({ targets: sprite, alpha: 0.15, duration: 250 });
        for (let shake = 0; shake < 3; shake += 1) {
            await this.tween({ targets: sprite, x: this.enemySlot.baseX + 6, duration: 90, yoyo: true });
            await this.wait(200);
        }

        if (Math.random() < chance) {
            const caught = { ...target, stats: { ...target.stats } };
            markPokemonCaught(caught.id);
            const destination = givePokemon(caught);
            this.battle.finished = true;
            this.syncCaughtIntoBattle();
            this.syncPartyState();
            this.setMessages([
                `Et hop ! ${target.name} est attrapé !`,
                destination === "box" ? `${target.name} est envoyé dans le PC.` : `${target.name} rejoint ton équipe !`
            ]);
            return;
        }

        await this.tween({ targets: sprite, alpha: 1, duration: 200 });
        await this.showBattleLog("Oh non ! Le Pokémon s'est libéré !", 600);
        this.phase = "command";
        this.resolveTurn(null);
    }

    // After a catch the saved team has one more Pokémon: don't overwrite it at the end.
    syncCaughtIntoBattle() {
        const saved = getParty();
        this.battle.party.forEach((pokemon, index) => {
            if (saved[index]) {
                saved[index] = { ...saved[index], stats: { ...pokemon.stats }, status: pokemon.status, moves: pokemon.moves, level: pokemon.level, exp: pokemon.exp };
            }
        });
        this.battle.party = saved;
    }

    handleMoveInput() {
        const activePokemon = this.battle.party[this.battle.activePartyIndex];
        if (this.isCancelPressed()) {
            this.phase = "command";
            this.refreshBattleView();
            return;
        }

        if (this.isUpPressed()) {
            this.moveIndex = Phaser.Math.Wrap(this.moveIndex - 1, 0, activePokemon.moves.length);
            this.refreshBattleView();
            return;
        }

        if (this.isDownPressed()) {
            this.moveIndex = Phaser.Math.Wrap(this.moveIndex + 1, 0, activePokemon.moves.length);
            this.refreshBattleView();
            return;
        }

        if (this.isConfirmPressed()) {
            const move = activePokemon.moves[this.moveIndex];
            if (move?.currentPp > 0) {
                this.resolveTurn(move);
                return;
            }

            if (move?.currentPp <= 0) {
                this.setMessages(["Plus de PP pour cette capacité !"]);
            }
        }
    }

    handlePartyInput() {
        if (this.isCancelPressed()) {
            this.phase = "command";
            this.refreshBattleView();
            return;
        }

        if (this.isUpPressed()) {
            this.switchIndex = Phaser.Math.Wrap(this.switchIndex - 1, 0, this.battle.party.length);
            this.refreshBattleView();
            return;
        }

        if (this.isDownPressed()) {
            this.switchIndex = Phaser.Math.Wrap(this.switchIndex + 1, 0, this.battle.party.length);
            this.refreshBattleView();
            return;
        }

        if (this.isConfirmPressed()) {
            this.switchActivePokemon(this.switchIndex);
        }
    }

    async switchActivePokemon(nextIndex) {
        const nextPokemon = this.battle.party[nextIndex];
        if (!nextPokemon || nextPokemon.stats.hp <= 0 || nextIndex === this.battle.activePartyIndex) {
            return;
        }

        this.phase = "busy";
        await this.loadArt(nextPokemon);
        this.battle.activePartyIndex = nextIndex;
        this.refreshBattleView(true);
        await this.animateSendOut(this.playerSlot);
        this.currentLogMessage = `Go ! ${nextPokemon.name} !`;
        this.phase = "command";
        this.refreshBattleView();
        this.syncPartyState();
    }

    async resolveTurn(playerMove) {
        if (!this.battle || this.phase === "busy" || this.animationQueue.isRunning()) {
            return;
        }

        this.phase = "busy";
        this.refreshBattleView();

        await this.animationQueue.add(async () => {
            const activePokemon = this.battle.party[this.battle.activePartyIndex];
            const wildPokemon = this.battle.wildPokemon;
            const actingOrder = activePokemon.stats.speed >= wildPokemon.stats.speed
                ? [
                    { side: "player", user: activePokemon, target: wildPokemon, move: playerMove },
                    { side: "wild", user: wildPokemon, target: activePokemon, move: this.chooseEnemyMove(wildPokemon) }
                ]
                : [
                    { side: "wild", user: wildPokemon, target: activePokemon, move: this.chooseEnemyMove(wildPokemon) },
                    { side: "player", user: activePokemon, target: wildPokemon, move: playerMove }
                ];

            for (const turn of actingOrder) {
                if (!this.battle || turn.user.stats.hp <= 0 || turn.target.stats.hp <= 0 || !turn.move || turn.move.currentPp <= 0) {
                    continue;
                }

                turn.move.currentPp = Math.max(0, turn.move.currentPp - 1);
                this.refreshBattleView();

                const attackerSlot = turn.side === "player" ? this.playerSlot : this.enemySlot;
                const defenderSlot = turn.side === "player" ? this.enemySlot : this.playerSlot;
                const defenderPanel = turn.side === "player" ? this.enemyInfo : this.playerInfo;
                const attackerName = turn.side === "player" ? turn.user.name : this.enemyLabel(turn.user);

                await this.showBattleLog(`${attackerName} utilise ${turn.move.displayName} !`);
                const shouldCheckAccuracy = Number.isFinite(turn.move.accuracy);
                if (shouldCheckAccuracy && Math.random() * 100 > turn.move.accuracy) {
                    await this.animateMiss(attackerSlot, turn.move);
                    await this.showBattleLog("Mais cela échoue !", 380);
                    continue;
                }

                const hpBefore = turn.target.stats.hp;
                const outcome = calculateDamage(turn.user, turn.target, turn.move);
                turn.target.stats.hp = clamp(turn.target.stats.hp - outcome.damage, 0, turn.target.stats.maxHp);

                await this.animateMove(attackerSlot, defenderSlot, turn.move, defenderPanel, turn.target, hpBefore, turn.target.stats.hp);
                if (outcome.damage > 0) {
                    await this.showBattleLog(`${turn.target.name} perd ${outcome.damage} PV !`, 340);
                } else if (turn.move.damageClass === "status") {
                    await this.showBattleLog("Mais rien ne se passe !", 300);
                } else if (outcome.effectiveness === 0) {
                    await this.showBattleLog("Ça n'affecte pas la cible...", 320);
                }

                if (outcome.effectiveness > NEUTRAL_EFFECTIVENESS) {
                    await this.showBattleLog("C'est super efficace !", 320);
                } else if (outcome.effectiveness > 0 && outcome.effectiveness < NEUTRAL_EFFECTIVENESS) {
                    await this.showBattleLog("Ce n'est pas très efficace...", 320);
                }

                if (turn.target.stats.hp <= 0) {
                    await this.animateFaint(defenderSlot);
                    this.currentLogMessage = turn.side === "player"
                        ? `${this.enemyLabel(turn.target)} est K.O. !`
                        : `${turn.target.name} est K.O. !`;
                    await this.showBattleLog(this.currentLogMessage, 420);
                }
            }

            await this.handlePostTurnState();
        });

        if (!this.visible || !this.battle) {
            return;
        }

        if (this.phase !== "message") {
            this.phase = "command";
            this.refreshBattleView(true);
        }
    }

    async handlePostTurnState() {
        const activePokemon = this.battle.party[this.battle.activePartyIndex];
        const wildPokemon = this.battle.wildPokemon;

        if (wildPokemon.stats.hp <= 0) {
            await this.gainExperience(activePokemon, wildPokemon);

            const trainer = this.battle.trainer;
            if (trainer && trainer.index < trainer.enemies.length - 1) {
                trainer.index += 1;
                const next = trainer.enemies[trainer.index];
                this.battle.wildPokemon = next;
                this.refreshBattleView(true);
                await this.animateSendOut(this.enemySlot);
                await this.showBattleLog(`${trainer.name} envoie ${next.name} !`, 600);
                this.syncPartyState();
                this.refreshBattleView(true);
                return;
            }

            this.battle.finished = true;
            this.battle.result = "win";
            this.syncPartyState();
            if (trainer) {
                if (trainer.prize > 0) {
                    addMoney(trainer.prize);
                }
                this.setMessages([
                    `Tu as battu ${trainer.name} !`,
                    trainer.defeatText,
                    trainer.prize > 0 ? `Tu reçois ${trainer.prize} Pokédollars !` : ""
                ]);
                return;
            }
            this.enterFinalMessagePhase();
            return;
        }

        if (activePokemon.stats.hp <= 0) {
            const nextIndex = getFirstAvailablePartyIndex(this.battle.party);
            if (nextIndex >= 0) {
                const nextPokemon = this.battle.party[nextIndex];
                await this.loadArt(nextPokemon);
                this.battle.activePartyIndex = nextIndex;
                this.refreshBattleView(true);
                await this.animateSendOut(this.playerSlot);
                await this.showBattleLog(`Go ! ${nextPokemon.name} !`, 400);
            } else {
                this.battle.finished = true;
                this.battle.result = "lose";
                this.syncPartyState();
                healParty();
                this.battle.party = getParty();
                if (this.battle.trainer?.allowLoss) {
                    this.setMessages([`Tu as perdu contre ${this.battle.trainer.name}...`]);
                    return;
                }
                // Back to the last Pokémon Center, short of half the money (as in the games).
                const lost = Math.floor(getMoney() / 2);
                addMoney(-lost);
                this.battle.whiteout = true;
                this.setMessages([
                    "Tu n'as plus de Pokémon en état de se battre !",
                    lost > 0 ? `Tu perds ${lost} Pokédollars...` : "",
                    "Tu cours te mettre à l'abri au Centre Pokémon..."
                ]);
                return;
            }
        }

        this.syncPartyState();
        this.refreshBattleView(true);
    }

    async animateMove(attackerSlot, defenderSlot, move, defenderPanel, targetPokemon, hpBefore, hpAfter) {
        if (move.damageClass === "special") {
            await this.animateSpecial(attackerSlot, defenderSlot, move);
        } else if (move.damageClass === "status") {
            await this.animateStatus(attackerSlot, defenderSlot, move, targetPokemon.status);
        } else {
            await this.animatePhysical(attackerSlot, defenderSlot, move);
        }

        await this.animateHpBar(defenderPanel, targetPokemon, hpBefore, hpAfter);
    }

    async animatePhysical(attackerSlot, defenderSlot) {
        const direction = attackerSlot.side === "player" ? 1 : -1;
        await this.tween({
            targets: attackerSlot.sprite,
            x: attackerSlot.baseX + (direction * 8),
            duration: 40,
            yoyo: true,
            repeat: 2
        });
        await this.tween({
            targets: attackerSlot.sprite,
            x: attackerSlot.baseX + (direction * 28),
            y: attackerSlot.baseY - 6,
            duration: 150
        });
        await this.tween({
            targets: defenderSlot.sprite,
            x: defenderSlot.baseX + (direction * 12),
            duration: 50,
            yoyo: true,
            repeat: 3
        });
        await this.flashSprite(defenderSlot.sprite, 3, 300);
        await this.tween({
            targets: attackerSlot.sprite,
            x: attackerSlot.baseX,
            y: attackerSlot.baseY,
            duration: 150
        });
    }

    async animateSpecial(attackerSlot, defenderSlot, move) {
        const color = Phaser.Display.Color.HexStringToColor(TYPE_COLORS[move.type] || TYPE_COLORS.Normal).color;
        await this.tween({
            targets: attackerSlot.sprite,
            scaleX: attackerSlot.sprite.scaleX * 1.05,
            scaleY: attackerSlot.sprite.scaleY * 1.05,
            duration: 150,
            yoyo: true
        });

        const projectile = this.scene.add.circle(attackerSlot.baseX, attackerSlot.baseY - Math.max(24, attackerSlot.sprite.displayHeight * 0.45), 8, color)
            .setDepth(this.root.depth + 1);
        this.root.add(projectile);
        await this.tween({
            targets: projectile,
            x: defenderSlot.baseX,
            y: defenderSlot.baseY - Math.max(24, defenderSlot.sprite.displayHeight * 0.45),
            duration: 400
        });
        projectile.destroy();
        await this.flashSprite(defenderSlot.sprite, 2, 200);
    }

    async animateStatus(attackerSlot, defenderSlot, move, status) {
        const color = Phaser.Display.Color.HexStringToColor(TYPE_COLORS[move.type] || TYPE_COLORS.Normal).color;
        this.typeOverlay.setFillStyle(color, 1);
        await this.tween({
            targets: this.typeOverlay,
            alpha: 0.4,
            duration: 200,
            yoyo: true
        });

        const badge = this.createText(
            defenderSlot.baseX,
            defenderSlot.baseY - Math.max(56, defenderSlot.sprite.displayHeight + 16),
            statusLabel(status) || "STATUT",
            8,
            "#ffffff"
        )
            .setOrigin(0.5, 1)
            .setAlpha(0)
            .setDepth(this.root.depth + 2);
        badge.setBackgroundColor(TYPE_COLORS[move.type] || TYPE_COLORS.Normal);
        badge.setPadding(4, 3, 4, 3);
        this.root.add(badge);
        await this.tween({
            targets: badge,
            alpha: 1,
            scaleX: 1.04,
            scaleY: 1.04,
            duration: 300
        });
        await this.wait(220);
        badge.destroy();
    }

    async animateMiss(attackerSlot, move) {
        if (move.damageClass === "special") {
            const color = Phaser.Display.Color.HexStringToColor(TYPE_COLORS[move.type] || TYPE_COLORS.Normal).color;
            await this.tween({
                targets: attackerSlot.sprite,
                scaleX: attackerSlot.sprite.scaleX * 1.05,
                scaleY: attackerSlot.sprite.scaleY * 1.05,
                duration: 150,
                yoyo: true
            });
            const projectile = this.scene.add.circle(attackerSlot.baseX, attackerSlot.baseY - Math.max(24, attackerSlot.sprite.displayHeight * 0.45), 8, color)
                .setDepth(this.root.depth + 1);
            this.root.add(projectile);
            const driftX = attackerSlot.side === "player" ? 96 : -96;
            await this.tween({
                targets: projectile,
                x: attackerSlot.baseX + driftX,
                y: attackerSlot.baseY - 90,
                alpha: 0,
                duration: 320
            });
            projectile.destroy();
            return;
        }

        const direction = attackerSlot.side === "player" ? 1 : -1;
        await this.tween({
            targets: attackerSlot.sprite,
            x: attackerSlot.baseX + (direction * 18),
            duration: 120,
            yoyo: true
        });
    }

    async animateHpBar(panel, pokemon, fromHp, toHp, duration = 600) {
        if (fromHp === toHp) {
            this.renderStatus(panel, pokemon, toHp);
            return;
        }

        await this.counterTween(fromHp, toHp, duration, (value) => {
            this.renderStatus(panel, pokemon, value);
        });
        this.renderStatus(panel, pokemon, toHp);
    }

    async animateFaint(slot) {
        await Promise.all([
            this.tween({
                targets: slot.sprite,
                alpha: 0,
                y: slot.baseY + 100,
                duration: 400
            }),
            this.tween({
                targets: slot.platform,
                alpha: 0,
                duration: 400
            })
        ]);
        slot.sprite.setVisible(false);
        slot.platform.setVisible(false);
    }

    async animateSendOut(slot) {
        slot.sprite.setVisible(true).setAlpha(0).setPosition(slot.baseX, slot.baseY + 24);
        slot.platform.setVisible(true).setAlpha(0);
        await this.tween({
            targets: slot.platform,
            alpha: 1,
            duration: 180
        });
        await this.tween({
            targets: slot.sprite,
            alpha: 1,
            y: slot.baseY,
            duration: 220
        });
    }

    async flashSprite(sprite, flashes, duration) {
        const interval = Math.max(40, Math.floor(duration / (flashes * 2)));
        for (let index = 0; index < flashes; index += 1) {
            sprite.setTintFill(0xffffff);
            await this.wait(interval);
            sprite.clearTint();
            await this.wait(interval);
        }
    }

    async showBattleLog(message, holdMs = 300) {
        this.currentLogMessage = message;
        this.refreshMessage();
        await this.wait(holdMs);
    }

    enterFinalMessagePhase() {
        this.messageQueue = [this.currentLogMessage || "Le combat est terminé."];
        this.messagePage = 0;
        this.phase = "message";
        this.refreshBattleView();
    }

    syncPartyState() {
        if (!this.battle) {
            return;
        }

        updateParty(this.battle.party);
    }

    healPartyAfterWhiteout() {
        this.battle.party = this.battle.party.map((pokemon) => ({
            ...pokemon,
            stats: {
                ...pokemon.stats,
                hp: Math.max(1, Math.floor(pokemon.stats.maxHp * 0.5))
            }
        }));
        this.syncPartyState();
    }

    enemyLabel(pokemon) {
        return this.battle?.trainer ? `${pokemon.name} ennemi` : `${pokemon.name} sauvage`;
    }

    // Opponents pick among their attacks rather than always the first one.
    chooseEnemyMove(pokemon) {
        const usable = (pokemon.moves || []).filter((move) => move.currentPp > 0);
        const attacks = usable.filter((move) => move.power > 0);
        const pool = attacks.length ? attacks : usable;
        return pool.length ? pool[Math.floor(Math.random() * pool.length)] : this.getFirstUsableMove(pokemon);
    }

    async gainExperience(pokemon, defeated) {
        if (!pokemon || pokemon.stats.hp <= 0) {
            return;
        }
        const amount = experienceReward(defeated, { trainer: Boolean(this.battle.trainer) });
        const panel = this.playerInfo;
        let from = experienceProgress(pokemon);
        const levels = applyExperience(pokemon, amount);

        // The EXP bar fills up; each new level empties it and starts again.
        panel.animatingExp = true;
        const fillTo = (to) => this.counterTween(from * 100, to * 100, 500, (value) => {
            panel.expBarFill.width = Math.round(panel.barWidth * (value / 100));
        });
        this.currentLogMessage = `${pokemon.name} gagne ${amount} points d'expérience !`;
        this.refreshMessage();
        for (const level of levels) {
            await fillTo(1);
            from = 0;
            panel.level.setText(`N.${level}`);
            this.renderStatus(panel, pokemon);
            await this.showBattleLog(`${pokemon.name} monte au niveau ${level} !`, 800);
        }
        await fillTo(experienceProgress(pokemon));
        panel.animatingExp = false;
        this.renderStatus(panel, pokemon);
        await this.wait(400);
    }

    endBattle() {
        const result = this.battle?.result || "none";
        const whiteout = Boolean(this.battle?.whiteout);
        const resolve = this.resolveBattle;
        this.resolveBattle = null;

        this.pendingTouchConfirm = false;
        this.visible = false;
        this.phase = "hidden";
        this.battle = null;
        this.messageQueue = [];
        this.currentLogMessage = "";
        this.root.setVisible(false);
        this.resetVisualState();
        this.messageLines.forEach((line) => line.setText(""));
        this.scene.input.keyboard.resetKeys();

        if (whiteout) {
            const destination = getWhiteoutDestination();
            this.scene.transitionToMap({ ...destination, playerTexturePosition: "back" });
        }
        if (resolve) {
            resolve({ won: result === "win", result });
        }
    }

    resetVisualState() {
        [this.enemySlot, this.playerSlot].forEach((slot) => {
            slot.sprite.setPosition(slot.baseX, slot.baseY);
            slot.sprite.setAlpha(1);
            slot.sprite.clearTint();
            slot.platform.setAlpha(1);
        });
        this.flashOverlay.setAlpha(0);
        this.typeOverlay.setAlpha(0);
    }

    // HD picture of a Pokémon (see pokemonArt.js); yours is shown mirrored, facing the opponent.
    loadArt(pokemon) {
        return loadPokemonArt(this.scene, pokemon.id, pokemon.sprite);
    }

    tween(config) {
        return new Promise((resolve) => {
            this.scene.tweens.add({
                ...config,
                onComplete: () => resolve()
            });
        });
    }

    counterTween(from, to, duration, onUpdate) {
        return new Promise((resolve) => {
            this.scene.tweens.addCounter({
                from,
                to,
                duration,
                onUpdate: (tween) => {
                    onUpdate(tween.getValue());
                },
                onComplete: () => resolve()
            });
        });
    }

    wait(delay) {
        return new Promise((resolve) => {
            this.scene.time.delayedCall(delay, resolve);
        });
    }

    isUpPressed() {
        return Phaser.Input.Keyboard.JustDown(this.keys.up) || Phaser.Input.Keyboard.JustDown(this.keys.w);
    }

    isDownPressed() {
        return Phaser.Input.Keyboard.JustDown(this.keys.down) || Phaser.Input.Keyboard.JustDown(this.keys.s);
    }

    isLeftPressed() {
        return Phaser.Input.Keyboard.JustDown(this.keys.left) || Phaser.Input.Keyboard.JustDown(this.keys.a);
    }

    isRightPressed() {
        return Phaser.Input.Keyboard.JustDown(this.keys.right) || Phaser.Input.Keyboard.JustDown(this.keys.d);
    }

    isConfirmPressed() {
        if (this.pendingTouchConfirm) {
            this.pendingTouchConfirm = false;
            return true;
        }
        return Phaser.Input.Keyboard.JustDown(this.keys.enter) || Phaser.Input.Keyboard.JustDown(this.keys.z);
    }

    isCancelPressed() {
        return Phaser.Input.Keyboard.JustDown(this.keys.escape) || Phaser.Input.Keyboard.JustDown(this.keys.x);
    }

    getFirstUsableMove(pokemon) {
        return (pokemon.moves || []).find((move) => move.currentPp > 0) || pokemon.moves?.[0] || null;
    }

    getMoveTextColor(move) {
        const ppRatio = move.maxPp > 0 ? move.currentPp / move.maxPp : 0;
        if (move.currentPp <= 0) {
            return "#8a8a8a";
        }
        // Dark text on the white panel; orange then red when PP run low.
        if (ppRatio <= 0.25) {
            return "#d83018";
        }
        if (ppRatio <= 0.5) {
            return "#d08000";
        }
        return COLORS.text;
    }
}

class BattleAnimationQueue {
    constructor() {
        this.queue = [];
        this.running = false;
    }

    add(fn) {
        return new Promise((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    await fn();
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });

            if (!this.running) {
                this.flush();
            }
        });
    }

    async flush() {
        this.running = true;
        while (this.queue.length > 0) {
            const next = this.queue.shift();
            await next();
        }
        this.running = false;
    }

    isRunning() {
        return this.running || this.queue.length > 0;
    }
}

function calculateDamage(attacker, defender, move) {
    if (!move || move.damageClass === "status" || !move.power) {
        return {
            damage: 0,
            effectiveness: NEUTRAL_EFFECTIVENESS
        };
    }

    const isSpecial = move.damageClass === "special";
    const attackStat = Math.max(1, isSpecial ? attacker.stats.spAttack : attacker.stats.attack);
    const defenseStat = Math.max(1, isSpecial ? defender.stats.spDefense : defender.stats.defense);
    const stab = attacker.type.includes(move.type) ? STAB_MULTIPLIER : 1;
    const effectiveness = getTypeEffectiveness(move.type, defender.type);
    const randomFactor = DAMAGE_VARIANCE_MIN + (Math.random() * (DAMAGE_VARIANCE_MAX - DAMAGE_VARIANCE_MIN));
    const baseDamage = (((attacker.level * 0.4) + 2) * move.power * (attackStat / defenseStat) / 24) + 2;
    const damage = effectiveness === 0
        ? 0
        : Math.max(1, Math.floor(baseDamage * stab * effectiveness * randomFactor));

    return {
        damage,
        effectiveness
    };
}

function getTypeEffectiveness(moveType, defenderTypes = []) {
    return (defenderTypes || []).reduce((multiplier, defenderType) => {
        const typeChart = TYPE_EFFECTIVENESS[moveType] || {};
        return multiplier * (typeChart[defenderType] ?? NEUTRAL_EFFECTIVENESS);
    }, NEUTRAL_EFFECTIVENESS);
}

function wrapMessage(message, width, maxLines) {
    const words = (message || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let current = "";

    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length > width) {
            if (current) {
                lines.push(current);
            }
            current = word;
        } else {
            current = candidate;
        }
    }

    if (current) {
        lines.push(current);
    }

    return lines.slice(0, maxLines);
}

function fitSprite(sprite, bounds, pokemon) {
    // The frame, not the whole image (a texture can be an atlas).
    const width = sprite.frame?.realWidth || 1;
    const height = sprite.frame?.realHeight || 1;
    const content = visibleBounds(sprite);
    // HD pictures all fill their frame: a Roucool (0.3 m) is drawn smaller than an Onix (8.8 m).
    const sizeFactor = Phaser.Math.Clamp(0.62 + ((pokemon?.height || 1) * 0.18), 0.62, 1);
    const scale = Math.min(bounds.maxWidth / content.width, bounds.maxHeight / content.height) * sizeFactor;

    sprite.setDisplaySize(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
    // Feet on the platform: the bottom of the visible pixels sits at the sprite's position.
    sprite.setOrigin((content.x + (content.width / 2)) / width, (content.y + content.height) / height);
}

const visibleBoundsCache = new Map();

// Box around the non-transparent pixels of the sprite's frame.
function visibleBounds(sprite) {
    const frame = sprite.frame;
    const key = `${sprite.texture?.key}:${frame?.name}`;
    if (visibleBoundsCache.has(key)) {
        return visibleBoundsCache.get(key);
    }

    const full = { x: 0, y: 0, width: frame?.realWidth || 1, height: frame?.realHeight || 1 };
    let bounds = full;
    try {
        const canvas = document.createElement("canvas");
        canvas.width = frame.cutWidth;
        canvas.height = frame.cutHeight;
        const context = canvas.getContext("2d");
        context.drawImage(frame.source.image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, frame.cutWidth, frame.cutHeight);
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
        let minX = canvas.width;
        let minY = canvas.height;
        let maxX = -1;
        let maxY = -1;
        for (let y = 0; y < canvas.height; y += 1) {
            for (let x = 0; x < canvas.width; x += 1) {
                if (data[((y * canvas.width) + x) * 4 + 3] > 16) {
                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x);
                    minY = Math.min(minY, y);
                    maxY = Math.max(maxY, y);
                }
            }
        }
        if (maxX >= 0) {
            bounds = { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
        }
    } catch (error) {
        // Picture we can't read back (cross-origin): use the whole frame.
    }

    visibleBoundsCache.set(key, bounds);
    return bounds;
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function getHpColor(percent) {
    if (percent > 0.5) {
        return COLORS.hpGreen;
    }
    if (percent > 0.25) {
        return COLORS.hpYellow;
    }
    return COLORS.hpRed;
}

