import Phaser from "phaser";
import { healParty, isPartyFullyHealed, setLastPokemonCenter, updatePokemonCenterState } from "./state/gameState";
import { VIEW } from "./ui/theme";

const FONT_FAMILY = "\"Press Start 2P\"";
const JOY_NAME = "Infirmière Joëlle";
const TILE_SIZE = 32;
const CENTER_INTERIORS = {
    pokemon_center_viridian: {
        joy: { x: 5, y: 4 },
        pc: { x: 1, y: 4 }
    },
    pokemon_center_pewter: {
        joy: { x: 5, y: 4 },
        pc: { x: 1, y: 4 }
    }
};
const COLORS = {
    wall: 0xf87878,
    wallBand: 0xd05858,
    counterTop: 0xe8b878,
    counterFront: 0xd0a060,
    floorA: 0xe8d0b8,
    floorB: 0xe0c8b0,
    pcBody: 0x3858c8,
    pcScreen: 0x80d8a0,
    machineBody: 0xc8e8f8,
    mat: 0xd04040,
    lightOn: 0xf8d800,
    lightOff: 0x909090,
    slotOn: 0xd04040,
    slotOff: 0x9a9a9a,
    panelBackground: 0xf0f0e0,
    panelBorder: 0x303848,
    text: "#2c2c2c",
    cursor: "#2c2c2c"
};

export default class PokemonCenterManager {
    constructor(scene) {
        this.scene = scene;
        this.definition = CENTER_INTERIORS[this.scene.mapName] || null;
        this.active = Boolean(this.definition);
        this.uiMode = "closed";
        this.selectedChoice = 0;
        this.textPages = [];
        this.textIndex = 0;
        this.choiceOptions = [];
        this.onTextComplete = null;
        this.onChoice = null;
        this.isAnimating = false;

        this.keys = this.scene.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.UP,
            down: Phaser.Input.Keyboard.KeyCodes.DOWN,
            w: Phaser.Input.Keyboard.KeyCodes.W,
            s: Phaser.Input.Keyboard.KeyCodes.S,
            a: Phaser.Input.Keyboard.KeyCodes.A,
            enter: Phaser.Input.Keyboard.KeyCodes.ENTER,
            z: Phaser.Input.Keyboard.KeyCodes.Z,
            escape: Phaser.Input.Keyboard.KeyCodes.ESC,
            x: Phaser.Input.Keyboard.KeyCodes.X
        });

        updatePokemonCenterState({
            isInsideCenter: this.active
        });

        if (!this.active) {
            return;
        }

        // After losing every battle, the player comes back to the last Center visited.
        setLastPokemonCenter(this.scene.mapName);
        this.createInteriorDecor();
        this.createUi();
        this.createPrompt();
        this.blinkVisible = true;
        this.blinkEvent = this.scene.time.addEvent({
            delay: 500,
            loop: true,
            callback: () => {
                this.blinkVisible = !this.blinkVisible;
                this.refreshUi();
            }
        });
    }

    destroy() {
        updatePokemonCenterState({
            isInsideCenter: false
        });

        if (!this.active) {
            return;
        }

        if (this.blinkEvent) {
            this.blinkEvent.remove();
        }

        if (this.prompt) {
            this.prompt.destroy();
        }

        if (this.uiRoot) {
            this.uiRoot.destroy(true);
        }

        if (this.flashOverlay) {
            this.flashOverlay.destroy();
        }

        if (this.decorRoot) {
            this.decorRoot.destroy(true);
        }
    }

    isBlockingGameplayInput() {
        return this.active && (this.uiMode !== "closed" || this.isAnimating);
    }

    update() {
        if (!this.active || this.scene.isMapTransitioning) {
            return;
        }

        if (!this.isBlockingGameplayInput() && (this.scene.isBattleOpen() || this.scene.isDialogueOpen() || this.scene.menuUi?.isBlockingGameplayInput())) {
            this.prompt.setVisible(false);
            return;
        }

        if (this.uiMode !== "closed") {
            this.updateUiInput();
            return;
        }

        const interaction = this.findInteraction();
        if (!interaction) {
            this.prompt.setVisible(false);
            return;
        }

        const promptText = interaction.kind === "joy" ? "A : PARLER" : "A : UTILISER LE PC";
        const promptX = interaction.tile.x * TILE_SIZE;
        const promptY = interaction.tile.y * TILE_SIZE;
        this.prompt
            .setText(promptText)
            .setPosition(promptX - 24, promptY + 10)
            .setVisible(true);

        if (this.isConfirmPressed()) {
            if (interaction.kind === "joy") {
                this.startJoyConversation();
            } else {
                this.startPcConversation();
            }
        }
    }

    // Rouge Feu style room: back wall with the Center's emblem, the nurse standing behind
    // a waist-high counter (row 3, solid), healing machine at her side, PC on the left,
    // cream floor with a big Poké Ball pattern.
    createInteriorDecor() {
        this.decorRoot = this.scene.add.container(0, 0).setDepth(3);
        const g = this.scene.add.graphics();
        const front = this.scene.add.graphics();
        const width = this.scene.map.widthInPixels;
        const height = this.scene.map.heightInPixels;
        const T = TILE_SIZE;

        // Floor: cream tiles and the Poké Ball pattern in the middle
        g.fillStyle(0xf2e6b8, 1).fillRect(0, 0, width, height);
        g.lineStyle(1, 0xe2d29a, 1);
        for (let x = 0; x <= width; x += T / 2) {
            g.lineBetween(x, T * 2, x, height);
        }
        for (let y = T * 2; y <= height; y += T / 2) {
            g.lineBetween(0, y, width, y);
        }
        const ballX = width / 2;
        const ballY = T * 6.2;
        g.fillStyle(0xfaf2d4, 1).fillCircle(ballX, ballY, 50);
        g.lineStyle(4, 0xe6d6a0, 1).strokeCircle(ballX, ballY, 50);
        g.lineStyle(4, 0xe6d6a0, 1).lineBetween(ballX - 50, ballY, ballX + 50, ballY);
        g.fillStyle(0xe6d6a0, 1).fillCircle(ballX, ballY, 14);
        g.fillStyle(0xfaf2d4, 1).fillCircle(ballX, ballY, 9);

        // Back wall: light, a red stripe at the bottom, windows and the Center's emblem
        g.fillGradientStyle(0xfff4dc, 0xfff4dc, 0xf6deb4, 0xf6deb4, 1);
        g.fillRect(0, 0, width, T * 2);
        g.fillStyle(0xd85848, 1).fillRect(0, T * 2 - 12, width, 12);
        g.fillStyle(0xf8f0e0, 1).fillRect(0, T * 2 - 14, width, 2);
        drawWindow(g, T * 0.9, T * 0.45);
        drawWindow(g, width - (T * 2.1), T * 0.45);
        g.fillStyle(0xd85848, 1).fillCircle(width / 2, T * 0.75, 15);
        g.fillStyle(0xffffff, 1).fillRect((width / 2) - 3, (T * 0.75) - 10, 6, 20);
        g.fillRect((width / 2) - 10, (T * 0.75) - 3, 20, 6);

        // Floor mat at the door
        g.fillStyle(0xc84838, 1).fillRoundedRect((width / 2) - 24, height - T + 4, 48, T - 10, 4);

        this.decorRoot.add(g);

        // The nurse stands behind the counter: the counter (drawn after her) hides her legs.
        this.joySprite = this.scene.add.image((5 * T) + 16, (T * 3) + 8, "players", "nurse_front.png")
            .setOrigin(0.5, 1)
            .setDisplaySize(T, T * 2);

        // Counter on row 3: white top, red front, from the PC to the right wall
        front.fillStyle(0x000000, 0.12).fillRect(T, (T * 4) - 2, width - (T * 2), 6);
        front.fillStyle(0xfaf6ee, 1).fillRoundedRect(T, (T * 3) - 2, width - (T * 2), 14, 4);
        front.fillStyle(0xe06050, 1).fillRect(T, (T * 3) + 10, width - (T * 2), 20);
        front.fillStyle(0xc04838, 1).fillRect(T, (T * 3) + 26, width - (T * 2), 4);
        front.fillStyle(0xf8d8c8, 1).fillRect((width / 2) - 24, (T * 3) + 15, 48, 8);

        this.pcUnit = createPcUnit(this.scene, T * 1.15, T * 2.35);
        this.machine = createHealingMachine(this.scene, T * 6.4, (T * 3) - 14);

        this.decorRoot.add(this.joySprite);
        this.decorRoot.add(front);
        this.decorRoot.add(this.machine.container);
        this.decorRoot.add(this.pcUnit.container);
    }

    createPrompt() {
        this.prompt = this.scene.add.text(0, 0, "A  PARLER", {
            fontFamily: FONT_FAMILY,
            fontSize: "8px",
            color: "#ffffff",
            backgroundColor: "#1c1c2e",
            padding: { x: 6, y: 4 }
        }).setDepth(40).setVisible(false);
    }

    createUi() {
        this.uiRoot = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(1150).setVisible(false);

        this.flashOverlay = this.scene.add.rectangle(0, 0, VIEW.width, VIEW.height, 0xffffff)
            .setOrigin(0)
            .setAlpha(0)
            .setScrollFactor(0)
            .setDepth(1140);

        this.uiPanel = this.scene.add.container(24, 302);
        this.uiPanel.add(this.createPanel(542, 116));
        this.nameTab = this.scene.add.container(36, 274);
        this.nameTab.add(this.createPanel(170, 38));
        this.nameText = this.createText(12, 10, "", 8);
        this.nameTab.add(this.nameText);

        this.dialogueLines = [
            this.createText(18, 18, "", 8),
            this.createText(18, 40, "", 8),
            this.createText(18, 62, "", 8),
            this.createText(18, 84, "", 8)
        ];
        this.dialogueLines.forEach((line) => this.uiPanel.add(line));

        this.cursor = this.createText(514, 84, "▌", 10, COLORS.cursor).setOrigin(1, 0);
        this.uiPanel.add(this.cursor);

        this.choicePanel = this.scene.add.container(594, 288).setVisible(false);
        this.choicePanel.add(this.createPanel(156, 110));
        this.choiceCursor = this.createText(14, 16, "►", 8);
        this.choiceLabels = [
            this.createText(34, 16, "", 8),
            this.createText(34, 42, "", 8),
            this.createText(34, 68, "", 8)
        ];
        this.choicePanel.add(this.choiceCursor);
        this.choiceLabels.forEach((label) => this.choicePanel.add(label));

        this.uiRoot.add(this.uiPanel);
        this.uiRoot.add(this.nameTab);
        this.uiRoot.add(this.choicePanel);
    }

    createPanel(width, height) {
        const container = this.scene.add.container(0, 0);
        const shadow = this.scene.add.rectangle(3, 3, width, height, 0xd8d0c0).setOrigin(0);
        const background = this.scene.add.rectangle(0, 0, width, height, COLORS.panelBackground).setOrigin(0);
        background.setStrokeStyle(3, COLORS.panelBorder);
        container.add([shadow, background]);
        return container;
    }

    createText(x, y, value, size, color = COLORS.text) {
        return this.scene.add.text(x, y, value, {
            fontFamily: FONT_FAMILY,
            fontSize: `${size}px`,
            color
        });
    }

    findInteraction() {
        const player = this.scene.player;
        if (!player) {
            return null;
        }

        const interactions = [
            { kind: "joy", tile: this.definition.joy },
            { kind: "pc", tile: this.definition.pc }
        ];

        return interactions.find((interaction) => {
            const worldX = (interaction.tile.x * TILE_SIZE) + 16;
            const worldY = (interaction.tile.y * TILE_SIZE) + 22;
            return Phaser.Math.Distance.Between(player.x, player.y, worldX, worldY) <= 44;
        }) || null;
    }

    startJoyConversation() {
        updatePokemonCenterState({
            hasInteractedWithJoy: true
        });

        if (isPartyFullyHealed()) {
            this.showTextSequence(JOY_NAME, [
                "Bienvenue au",
                "Centre Pokémon !"
            ], () => {
                this.showTextSequence(JOY_NAME, [
                    "Tes Pokémon ont",
                    "l'air en pleine forme !"
                ], () => {
                    this.showTextSequence(JOY_NAME, [
                        "Reviens quand tu veux",
                        "si tu as besoin",
                        "d'aide."
                    ]);
                });
            });
            return;
        }

        this.showTextSequence(JOY_NAME, [
            "Bienvenue au",
            "Centre Pokémon !",
            "Nous soignons tes",
            "Pokémon entièrement."
        ], () => {
            this.showChoice(JOY_NAME, [
                "Veux-tu que je",
                "soigne tes Pokémon ?"
            ], [
                {
                    label: "Oui !",
                    onSelect: async () => {
                        this.showTextSequence(JOY_NAME, [
                            "D'accord ! Je vais",
                            "bien m'en occuper..."
                        ], async () => {
                            await this.playHealingAnimation();
                            healParty();
                            this.showTextSequence(JOY_NAME, [
                                "Tes Pokémon sont",
                                "en pleine forme !",
                                "Bonne chance pour",
                                "ton aventure !"
                            ]);
                        });
                    }
                },
                {
                    label: "Non",
                    onSelect: () => {
                        this.showTextSequence(JOY_NAME, [
                            "D'accord ! Reviens",
                            "quand tu veux si tu",
                            "as besoin d'aide."
                        ]);
                    }
                }
            ]);
        });
    }

    startPcConversation() {
        this.showChoice("PC", [
            "Que veux-tu faire ?"
        ], [
            {
                label: "Pokémon",
                onSelect: () => {
                    this.closeUi();
                    this.scene.menuUi.openPartyView({ fromPc: true });
                }
            },
            {
                label: "Pokédex",
                onSelect: () => {
                    this.closeUi();
                    this.scene.menuUi.openPokedexView({ fromPc: true });
                }
            },
            {
                label: "Quitter",
                onSelect: () => {
                    this.showTextSequence("PC", [
                        "Le PC s'éteint."
                    ]);
                }
            }
        ]);
    }

    showTextSequence(name, lines, onComplete = null) {
        this.uiMode = "text";
        this.nameText.setText(name);
        this.textPages = splitDialogueLines(lines);
        this.textIndex = 0;
        this.onTextComplete = onComplete;
        this.choiceOptions = [];
        this.uiRoot.setVisible(true);
        this.choicePanel.setVisible(false);
        this.refreshUi();
    }

    showChoice(name, lines, options) {
        this.uiMode = "choice";
        this.nameText.setText(name);
        this.textPages = [splitDialogueLines(lines)[0]];
        this.textIndex = 0;
        this.selectedChoice = 0;
        this.choiceOptions = options;
        this.onChoice = null;
        this.uiRoot.setVisible(true);
        this.choicePanel.setVisible(true);
        this.refreshUi();
    }

    closeUi() {
        this.uiMode = "closed";
        this.uiRoot.setVisible(false);
        this.choicePanel.setVisible(false);
        this.flashOverlay.setAlpha(0);
        this.prompt.setVisible(false);
        this.scene.input.keyboard.resetKeys();
    }

    refreshUi() {
        if (!this.active || !this.uiRoot) {
            return;
        }

        if (this.uiMode === "closed") {
            this.uiRoot.setVisible(false);
            return;
        }

        this.uiRoot.setVisible(true);
        const currentPage = this.textPages[this.textIndex] || ["", "", "", ""];
        this.dialogueLines.forEach((line, index) => {
            line.setText(currentPage[index] || "");
        });
        this.cursor.setVisible(this.blinkVisible && this.uiMode !== "choice");

        this.choicePanel.setVisible(this.uiMode === "choice");
        this.choiceCursor.setVisible(this.blinkVisible && this.uiMode === "choice");
        if (this.uiMode === "choice") {
            this.choiceCursor.y = 16 + (this.selectedChoice * 26);
            this.choiceLabels.forEach((label, index) => {
                const option = this.choiceOptions[index];
                label.setText(option ? option.label : "");
                label.setColor(index === this.selectedChoice ? COLORS.cursor : COLORS.text);
            });
        }
    }

    updateUiInput() {
        if (this.isAnimating) {
            return;
        }

        if (this.uiMode === "text") {
            if (this.isConfirmPressed()) {
                this.advanceText();
            }
            return;
        }

        if (this.uiMode !== "choice") {
            return;
        }

        if (this.isUpPressed()) {
            this.selectedChoice = Phaser.Math.Wrap(this.selectedChoice - 1, 0, this.choiceOptions.length);
            this.refreshUi();
            return;
        }

        if (this.isDownPressed()) {
            this.selectedChoice = Phaser.Math.Wrap(this.selectedChoice + 1, 0, this.choiceOptions.length);
            this.refreshUi();
            return;
        }

        if (this.isCancelPressed()) {
            this.closeUi();
            return;
        }

        if (this.isConfirmPressed()) {
            const option = this.choiceOptions[this.selectedChoice];
            if (option?.onSelect) {
                option.onSelect();
            } else {
                this.closeUi();
            }
        }
    }

    advanceText() {
        this.textIndex += 1;
        if (this.textIndex < this.textPages.length) {
            this.refreshUi();
            return;
        }

        const onComplete = this.onTextComplete;
        this.onTextComplete = null;
        if (onComplete) {
            onComplete();
            return;
        }

        this.closeUi();
    }

    async playHealingAnimation() {
        this.isAnimating = true;
        this.closeUi();
        await this.tween({
            targets: this.joySprite,
            y: this.joySprite.y + 4,
            duration: 100,
            yoyo: true
        });

        await this.tween({
            targets: this.flashOverlay,
            alpha: 0.85,
            duration: 300,
            yoyo: true
        });

        for (let index = 0; index < 5; index += 1) {
            this.machine.light.setFillStyle(index % 2 === 0 ? COLORS.lightOn : COLORS.lightOff);
            await this.wait(80);
        }

        this.machine.slots.forEach((slot) => slot.setFillStyle(COLORS.slotOff));
        for (let index = 0; index < this.machine.slots.length; index += 1) {
            this.machine.slots[index].setFillStyle(COLORS.slotOn);
            this.machine.light.setFillStyle(COLORS.lightOn);
            await this.wait(200);
        }

        this.machine.light.setFillStyle(COLORS.lightOff);
        this.isAnimating = false;
    }

    tween(config) {
        return new Promise((resolve) => {
            this.scene.tweens.add({
                ...config,
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

    isConfirmPressed() {
        return Phaser.Input.Keyboard.JustDown(this.keys.enter)
            || Phaser.Input.Keyboard.JustDown(this.keys.z)
            || Phaser.Input.Keyboard.JustDown(this.keys.a);
    }

    isCancelPressed() {
        return Phaser.Input.Keyboard.JustDown(this.keys.escape) || Phaser.Input.Keyboard.JustDown(this.keys.x);
    }
}

function drawWindow(graphics, x, y) {
    graphics.fillStyle(0xc8f0ff, 1);
    graphics.fillRect(x, y, 36, 24);
    graphics.fillStyle(0x98d8ff, 1);
    graphics.fillRect(x + 2, y + 2, 14, 9);
    graphics.fillRect(x + 20, y + 2, 14, 9);
    graphics.fillRect(x + 2, y + 13, 14, 9);
    graphics.fillRect(x + 20, y + 13, 14, 9);
}

// The storage PC: a tall terminal standing on the left end of the counter.
function createPcUnit(scene, x, y) {
    const container = scene.add.container(x, y).setDepth(4);
    const g = scene.add.graphics();
    g.fillStyle(0x2c3c78, 1).fillRoundedRect(0, 0, 30, 36, 4);
    g.fillStyle(0x4868c8, 1).fillRoundedRect(2, 2, 26, 32, 3);
    g.fillStyle(0x88e0b0, 1).fillRect(6, 6, 18, 12);
    g.fillStyle(0xc8f8d8, 1).fillRect(8, 8, 6, 3);
    g.fillStyle(0x2c3c78, 1).fillRect(6, 22, 18, 3);
    g.fillRect(6, 27, 12, 3);
    container.add(g);
    return { container };
}

// Healing machine on the counter: six Poké Ball slots and a light.
function createHealingMachine(scene, x, y) {
    const container = scene.add.container(x, y).setDepth(4);
    const g = scene.add.graphics();
    g.fillStyle(0x8898a8, 1).fillRoundedRect(0, 0, 46, 26, 5);
    g.fillStyle(0xd8e4ee, 1).fillRoundedRect(2, 2, 42, 22, 4);
    const light = scene.add.circle(38, 7, 3, COLORS.lightOff).setOrigin(0.5);
    const slots = [
        scene.add.circle(9, 10, 4, COLORS.slotOn),
        scene.add.circle(19, 10, 4, COLORS.slotOn),
        scene.add.circle(29, 10, 4, COLORS.slotOn),
        scene.add.circle(9, 19, 4, COLORS.slotOn),
        scene.add.circle(19, 19, 4, COLORS.slotOn),
        scene.add.circle(29, 19, 4, COLORS.slotOn)
    ];
    container.add([g, light, ...slots]);
    return { container, light, slots };
}

function splitDialogueLines(lines) {
    const source = Array.isArray(lines) ? lines : [lines];
    const wrapped = [];
    source.forEach((line) => {
        wrapDialogueLine(line, 22).forEach((wrappedLine) => wrapped.push(wrappedLine));
    });

    const pages = [];
    for (let index = 0; index < wrapped.length; index += 4) {
        pages.push([
            wrapped[index] || "",
            wrapped[index + 1] || "",
            wrapped[index + 2] || "",
            wrapped[index + 3] || ""
        ]);
    }

    return pages.length ? pages : [["", "", "", ""]];
}

function wrapDialogueLine(text, maxLength) {
    const words = (text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let currentLine = "";

    for (const word of words) {
        const candidate = currentLine ? `${currentLine} ${word}` : word;
        if (candidate.length > maxLength) {
            if (currentLine) {
                lines.push(currentLine);
            }
            currentLine = word;
        } else {
            currentLine = candidate;
        }
    }

    if (currentLine) {
        lines.push(currentLine);
    }

    return lines.length ? lines : [""];
}
