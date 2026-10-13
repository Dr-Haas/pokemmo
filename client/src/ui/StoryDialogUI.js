import Phaser from "phaser";
import { VIEW } from "./theme";

// Rouge Feu style text box for the adventure: say() shows lines page by page, ask()
// adds a list of choices. Both return promises, so scripts read top to bottom.

const FONT_FAMILY = "\"Press Start 2P\"";
const LINE_LENGTH = 54;
const LINES_PER_PAGE = 2;
const COLORS = {
    panel: 0xf8f8f8,
    border: 0x506878,
    shadow: 0xb8c8d0,
    text: "#303030",
    cursor: "#e03030",
    nameTab: 0x506878,
    nameText: "#ffffff"
};

export default class StoryDialogUI {
    constructor(scene) {
        this.scene = scene;
        this.visible = false;
        this.pages = [];
        this.pageIndex = 0;
        this.choices = null;
        this.choiceIndex = 0;
        this.resolve = null;
        this.pendingTap = false;

        this.keys = scene.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.UP,
            down: Phaser.Input.Keyboard.KeyCodes.DOWN,
            enter: Phaser.Input.Keyboard.KeyCodes.ENTER,
            z: Phaser.Input.Keyboard.KeyCodes.Z,
            x: Phaser.Input.Keyboard.KeyCodes.X,
            escape: Phaser.Input.Keyboard.KeyCodes.ESC
        });

        const width = VIEW.width;
        this.root = scene.add.container(0, 0).setScrollFactor(0).setDepth(1150).setVisible(false);

        const box = scene.add.graphics();
        box.fillStyle(COLORS.shadow, 1).fillRoundedRect(20, 342, width - 36, 96, 8);
        box.fillStyle(COLORS.panel, 1).fillRoundedRect(16, 338, width - 36, 96, 8);
        box.lineStyle(4, COLORS.border, 1).strokeRoundedRect(16, 338, width - 36, 96, 8);
        this.nameTab = scene.add.graphics();
        this.nameText = this.text(36, 318, "", 9, COLORS.nameText);
        this.lines = [this.text(40, 362, "", 11), this.text(40, 396, "", 11)];
        this.cursor = this.text(width - 44, 410, "▼", 10, COLORS.cursor);

        // Tap the box to go on (phones).
        const tapZone = scene.add.rectangle(16, 338, width - 36, 96, 0xffffff, 0.001)
            .setOrigin(0)
            .setScrollFactor(0)
            .setInteractive()
            .on("pointerdown", () => {
                if (this.visible && !this.choices) {
                    this.pendingTap = true;
                }
            });

        this.choiceBox = scene.add.container(0, 0).setVisible(false);
        this.root.add([box, this.nameTab, this.nameText, ...this.lines, this.cursor, tapZone, this.choiceBox]);

        this.blink = scene.time.addEvent({
            delay: 450,
            loop: true,
            callback: () => this.cursor.setAlpha(this.cursor.alpha > 0.5 ? 0.2 : 1)
        });
    }

    text(x, y, value, size, color = COLORS.text) {
        return this.scene.add.text(x, y, value, { fontFamily: FONT_FAMILY, fontSize: `${size}px`, color });
    }

    destroy() {
        this.blink.remove();
        this.root.destroy(true);
    }

    isOpen() {
        return this.visible;
    }

    /** Shows the lines (each one wrapped to the box), resolves once the player read them all. */
    say(name, lines) {
        return this.open(name, lines, null);
    }

    /** Shows the lines, then the choices; resolves with the chosen index (B: the last one). */
    ask(name, lines, choices) {
        return this.open(name, lines, choices);
    }

    open(name, lines, choices) {
        this.pages = paginate(lines);
        this.pageIndex = 0;
        this.pendingChoices = choices;
        this.choices = null;
        this.visible = true;
        this.root.setVisible(true);
        this.setName(name);
        this.showPage();
        this.scene.input.keyboard.resetKeys();
        return new Promise((resolve) => {
            this.resolve = resolve;
        });
    }

    setName(name) {
        this.nameTab.clear();
        this.nameText.setText(name || "");
        if (name) {
            this.nameTab.fillStyle(COLORS.nameTab, 1).fillRoundedRect(24, 310, this.nameText.width + 24, 26, 6);
        }
    }

    showPage() {
        const page = this.pages[this.pageIndex] || [];
        this.lines.forEach((line, index) => line.setText(page[index] || ""));
        const lastPage = this.pageIndex === this.pages.length - 1;
        if (lastPage && this.pendingChoices) {
            this.showChoices(this.pendingChoices);
        }
        this.cursor.setVisible(!this.choices);
    }

    showChoices(choices) {
        this.choices = choices;
        this.choiceIndex = 0;
        this.choiceBox.removeAll(true);
        const width = Math.max(...choices.map((label) => label.length)) * 10 + 64;
        const height = choices.length * 30 + 20;
        const x = VIEW.width - width - 20;
        const y = 330 - height;
        const panel = this.scene.add.graphics();
        panel.fillStyle(COLORS.panel, 1).fillRoundedRect(x, y, width, height, 8);
        panel.lineStyle(4, COLORS.border, 1).strokeRoundedRect(x, y, width, height, 8);
        this.choiceBox.add(panel);
        this.choiceLabels = choices.map((label, index) => {
            const text = this.text(x + 40, y + 16 + (index * 30), label, 10)
                .setScrollFactor(0)
                .setInteractive({ useHandCursor: true })
                .on("pointerdown", () => {
                    if (this.choices) {
                        this.choiceIndex = index;
                        this.finish(index);
                    }
                });
            this.choiceBox.add(text);
            return text;
        });
        this.choiceCursor = this.text(x + 18, y + 16, "►", 10, COLORS.cursor);
        this.choiceBox.add(this.choiceCursor);
        this.choiceBox.setVisible(true);
        this.refreshChoice();
    }

    refreshChoice() {
        this.choiceCursor.y = this.choiceLabels[this.choiceIndex].y;
    }

    update() {
        if (!this.visible) {
            return;
        }
        const confirm = this.pendingTap
            || Phaser.Input.Keyboard.JustDown(this.keys.z)
            || Phaser.Input.Keyboard.JustDown(this.keys.enter);
        this.pendingTap = false;
        const cancel = Phaser.Input.Keyboard.JustDown(this.keys.x) || Phaser.Input.Keyboard.JustDown(this.keys.escape);

        if (this.choices) {
            if (Phaser.Input.Keyboard.JustDown(this.keys.up)) {
                this.choiceIndex = Phaser.Math.Wrap(this.choiceIndex - 1, 0, this.choices.length);
                this.refreshChoice();
            } else if (Phaser.Input.Keyboard.JustDown(this.keys.down)) {
                this.choiceIndex = Phaser.Math.Wrap(this.choiceIndex + 1, 0, this.choices.length);
                this.refreshChoice();
            } else if (confirm) {
                this.finish(this.choiceIndex);
            } else if (cancel) {
                this.finish(this.choices.length - 1);
            }
            return;
        }

        if (confirm || cancel) {
            if (this.pageIndex < this.pages.length - 1) {
                this.pageIndex += 1;
                this.showPage();
            } else {
                this.finish(null);
            }
        }
    }

    finish(value) {
        this.visible = false;
        this.choices = null;
        this.pendingChoices = null;
        this.choiceBox.setVisible(false);
        this.root.setVisible(false);
        this.scene.input.keyboard.resetKeys();
        const resolve = this.resolve;
        this.resolve = null;
        if (resolve) {
            resolve(value);
        }
    }
}

// Each line of text is wrapped to the box width; pages hold two box lines.
function paginate(lines) {
    const wrapped = [];
    lines.filter(Boolean).forEach((line) => {
        let current = "";
        String(line).split(" ").forEach((word) => {
            const candidate = current ? `${current} ${word}` : word;
            if (candidate.length > LINE_LENGTH && current) {
                wrapped.push(current);
                current = word;
            } else {
                current = candidate;
            }
        });
        if (current) {
            wrapped.push(current);
        }
        // A sentence starts on a new page when it would split awkwardly.
        if (wrapped.length % LINES_PER_PAGE !== 0) {
            wrapped.push("");
        }
    });
    const pages = [];
    for (let index = 0; index < wrapped.length; index += LINES_PER_PAGE) {
        pages.push(wrapped.slice(index, index + LINES_PER_PAGE));
    }
    return pages.length ? pages : [[""]];
}
