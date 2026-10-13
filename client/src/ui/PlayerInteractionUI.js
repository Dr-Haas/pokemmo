import Phaser from "phaser";
import { VIEW } from "./theme";

/*
 * Panels used when two players meet:
 *  - the action menu (Pokédex / Badges / Combat)
 *  - yes/no questions (a challenge received)
 *  - short messages ("Défi envoyé...")
 *  - the other player's Pokédex and badges
 *
 * Works with the keyboard / on-screen pad (arrows, A = Z, B = X)
 * and by tapping directly on an option.
 */

const FONT_FAMILY = "\"Press Start 2P\"";
const COLORS = {
    background: 0xf0ead8,
    border: 0x2c2c2c,
    shadow: 0x000000,
    header: 0x2848c8,
    headerText: "#ffffff",
    text: "#2c2c2c",
    muted: "#8a8478",
    cursor: "#d8344f",
    selected: 0xf8d800
};
const BADGE_COLORS = [0x9a9a9a, 0x4aa8f0, 0xf8d030, 0x78c850, 0xd070c0, 0xf8a8c8, 0xf86830, 0x50b878];
const POKEDEX_COLUMNS = 3;
const POKEDEX_ROWS = 7;

export default class PlayerInteractionUI {
    constructor(scene) {
        this.scene = scene;
        this.mode = "closed";
        this.options = [];
        this.index = 0;
        this.page = 0;

        this.keys = scene.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.UP,
            down: Phaser.Input.Keyboard.KeyCodes.DOWN,
            left: Phaser.Input.Keyboard.KeyCodes.LEFT,
            right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
            z: Phaser.Input.Keyboard.KeyCodes.Z,
            enter: Phaser.Input.Keyboard.KeyCodes.ENTER,
            x: Phaser.Input.Keyboard.KeyCodes.X,
            escape: Phaser.Input.Keyboard.KeyCodes.ESC
        });

        this.root = scene.add.container(0, 0).setScrollFactor(0).setDepth(1100).setVisible(false);
        this.dim = scene.add.rectangle(0, 0, VIEW.width, VIEW.height, 0x000000, 0.35)
            .setOrigin(0)
            .setScrollFactor(0)
            .setInteractive()
            .on("pointerdown", () => {
                // Tapping outside a closable panel closes it.
                if (this.mode === "pokedex" || this.mode === "badges" || this.mode === "menu") {
                    this.cancel();
                }
            });
        this.root.add(this.dim);
        this.content = scene.add.container(0, 0);
        this.root.add(this.content);
    }

    destroy() {
        this.root.destroy(true);
    }

    isOpen() {
        return this.mode !== "closed";
    }

    /* ------------------------------------------------------------------ */
    /* Public API                                                         */
    /* ------------------------------------------------------------------ */

    /** List of choices. options: [{ id, label, disabled? }] */
    openMenu(title, options, { onSelect, onCancel } = {}) {
        this.open("menu");
        this.callbacks = { onSelect, onCancel };
        this.options = options;
        this.index = 0;
        this.renderChoicePanel(title, null, options);
    }

    /** Yes / no question. */
    confirm(message, { yes = "Oui", no = "Non", onYes, onNo }) {
        this.open("confirm");
        const options = [{ id: "yes", label: yes }, { id: "no", label: no }];
        this.callbacks = {
            onSelect: (option) => (option.id === "yes" ? onYes : onNo)?.(),
            onCancel: onNo
        };
        this.options = options;
        this.index = 0;
        this.renderChoicePanel(null, message, options);
    }

    /**
     * A message. With onCancel, B cancels (e.g. a pending challenge).
     * Otherwise A or B closes it.
     */
    message(text, { onClose, onCancel, cancelLabel, sticky = false } = {}) {
        this.open("message");
        this.callbacks = { onClose, onCancel };
        this.sticky = sticky;
        this.options = [];
        const hint = onCancel ? `B : ${cancelLabel || "Annuler"}` : (sticky ? "" : "A : OK");
        this.renderMessagePanel(text, hint);
    }

    showPokedex(name, profile) {
        this.open("pokedex");
        this.callbacks = {};
        this.profile = profile;
        this.profileName = name;
        this.page = 0;
        this.renderPokedex();
    }

    showBadges(name, profile) {
        this.open("badges");
        this.callbacks = {};
        this.profile = profile;
        this.profileName = name;
        this.renderBadges();
    }

    close() {
        this.mode = "closed";
        this.root.setVisible(false);
        this.content.removeAll(true);
        this.scene.input.keyboard.resetKeys();
    }

    /* ------------------------------------------------------------------ */
    /* Input                                                              */
    /* ------------------------------------------------------------------ */

    update() {
        if (!this.isOpen()) {
            return;
        }
        const pressed = (...keys) => keys.some((key) => Phaser.Input.Keyboard.JustDown(this.keys[key]));
        const confirm = pressed("z", "enter");
        const cancel = pressed("x", "escape");

        if (this.mode === "menu" || this.mode === "confirm") {
            if (pressed("up")) {
                this.moveCursor(-1);
            } else if (pressed("down")) {
                this.moveCursor(1);
            } else if (confirm) {
                this.select(this.index);
            } else if (cancel) {
                this.cancel();
            }
            return;
        }

        if (this.mode === "message") {
            if (this.callbacks.onCancel) {
                if (cancel) {
                    this.cancel();
                }
                return;
            }
            if (!this.sticky && (confirm || cancel)) {
                const onClose = this.callbacks.onClose;
                this.close();
                onClose?.();
            }
            return;
        }

        if (this.mode === "pokedex") {
            const pages = this.getPokedexPageCount();
            if (pressed("right", "down") && this.page < pages - 1) {
                this.page += 1;
                this.renderPokedex();
            } else if (pressed("left", "up") && this.page > 0) {
                this.page -= 1;
                this.renderPokedex();
            } else if (confirm || cancel) {
                this.close();
            }
            return;
        }

        if (this.mode === "badges" && (confirm || cancel)) {
            this.close();
        }
    }

    moveCursor(step) {
        const count = this.options.length;
        for (let tries = 0; tries < count; tries += 1) {
            this.index = Phaser.Math.Wrap(this.index + step, 0, count);
            if (!this.options[this.index].disabled) {
                break;
            }
        }
        this.refreshChoices();
    }

    select(index) {
        const option = this.options[index];
        if (!option || option.disabled) {
            return;
        }
        const onSelect = this.callbacks.onSelect;
        this.close();
        onSelect?.(option);
    }

    cancel() {
        const onCancel = this.callbacks.onCancel;
        this.close();
        onCancel?.();
    }

    /* ------------------------------------------------------------------ */
    /* Rendering                                                          */
    /* ------------------------------------------------------------------ */

    open(mode) {
        this.mode = mode;
        this.content.removeAll(true);
        this.root.setVisible(true);
        this.scene.input.keyboard.resetKeys();
    }

    panel(x, y, width, height) {
        const graphics = this.scene.add.graphics();
        graphics.fillStyle(COLORS.shadow, 0.25);
        graphics.fillRoundedRect(x + 4, y + 4, width, height, 6);
        graphics.fillStyle(COLORS.background, 1);
        graphics.lineStyle(3, COLORS.border, 1);
        graphics.fillRoundedRect(x, y, width, height, 6);
        graphics.strokeRoundedRect(x, y, width, height, 6);
        this.content.add(graphics);
        return graphics;
    }

    header(x, y, width, label) {
        const bar = this.scene.add.graphics();
        bar.fillStyle(COLORS.header, 1);
        bar.fillRoundedRect(x + 3, y + 3, width - 6, 30, { tl: 4, tr: 4, bl: 0, br: 0 });
        this.content.add(bar);
        this.content.add(this.text(x + 16, y + 12, label, 10, COLORS.headerText));
    }

    text(x, y, value, size, color = COLORS.text) {
        return this.scene.add.text(x, y, value, {
            fontFamily: FONT_FAMILY,
            fontSize: `${size}px`,
            color,
            lineSpacing: 6
        });
    }

    renderChoicePanel(title, message, options) {
        const width = 300;
        const lineHeight = 30;
        const messageLines = message ? this.wrap(message, 26) : [];
        const top = title ? 44 : 18;
        const messageHeight = messageLines.length * 18 + (messageLines.length ? 14 : 0);
        const height = top + messageHeight + options.length * lineHeight + 14;
        const x = VIEW.width - width - 24;
        const y = VIEW.height - height - 24;

        this.panel(x, y, width, height);
        if (title) {
            this.header(x, y, width, title);
        }
        messageLines.forEach((line, lineIndex) => {
            this.content.add(this.text(x + 18, y + top + lineIndex * 18, line, 9));
        });

        const optionsTop = y + top + messageHeight;
        this.choiceViews = options.map((option, optionIndex) => {
            const rowY = optionsTop + optionIndex * lineHeight;
            const highlight = this.scene.add.rectangle(x + 10, rowY - 6, width - 20, lineHeight - 4, COLORS.selected, 0.45)
                .setOrigin(0)
                .setVisible(false);
            const label = this.text(x + 44, rowY + 2, option.label, 10, option.disabled ? COLORS.muted : COLORS.text);
            const hit = this.scene.add.rectangle(x + 10, rowY - 6, width - 20, lineHeight - 4, 0xffffff, 0.001)
                .setOrigin(0)
                .setScrollFactor(0)
                .setInteractive({ useHandCursor: true })
                .on("pointerdown", () => {
                    this.index = optionIndex;
                    this.refreshChoices();
                    this.scene.time.delayedCall(90, () => this.select(optionIndex));
                });
            this.content.add([highlight, label, hit]);
            return { highlight, label };
        });
        this.cursor = this.text(x + 20, 0, "►", 10, COLORS.cursor);
        this.content.add(this.cursor);
        this.choiceTop = optionsTop;
        this.choiceLineHeight = lineHeight;

        if (this.options[this.index]?.disabled) {
            this.moveCursor(1);
        }
        this.refreshChoices();
    }

    refreshChoices() {
        if (!this.choiceViews) {
            return;
        }
        this.choiceViews.forEach((view, viewIndex) => view.highlight.setVisible(viewIndex === this.index));
        this.cursor.setY(this.choiceTop + this.index * this.choiceLineHeight + 2);
    }

    renderMessagePanel(message, hint) {
        const width = 420;
        const lines = this.wrap(message, 36);
        const height = 34 + lines.length * 18 + (hint ? 26 : 0);
        const x = (VIEW.width - width) / 2;
        const y = VIEW.height - height - 24;
        this.panel(x, y, width, height);
        lines.forEach((line, lineIndex) => this.content.add(this.text(x + 18, y + 18 + lineIndex * 18, line, 9)));
        if (hint) {
            this.content.add(this.text(x + width - 18, y + height - 22, hint, 8, COLORS.muted).setOrigin(1, 0));
        }
        // Tap to close / cancel too.
        const hit = this.scene.add.rectangle(x, y, width, height, 0xffffff, 0.001).setOrigin(0).setScrollFactor(0).setInteractive()
            .on("pointerdown", () => {
                if (this.callbacks.onCancel) {
                    this.cancel();
                } else if (!this.sticky) {
                    const onClose = this.callbacks.onClose;
                    this.close();
                    onClose?.();
                }
            });
        this.content.add(hit);
    }

    getCaughtList() {
        const pokedex = this.profile?.pokedex || {};
        const caught = new Set(pokedex.caughtIds || []);
        return (pokedex.seenIds || [])
            .slice()
            .sort((first, second) => first - second)
            .map((id) => ({ id, name: pokedex.names?.[id] || `#${id}`, caught: caught.has(id) }));
    }

    getPokedexPageCount() {
        return Math.max(1, Math.ceil(this.getCaughtList().length / (POKEDEX_COLUMNS * POKEDEX_ROWS)));
    }

    renderPokedex() {
        this.content.removeAll(true);
        const x = 40;
        const y = 24;
        const width = VIEW.width - 80;
        const height = VIEW.height - 48;
        this.panel(x, y, width, height);
        this.header(x, y, width, `POKÉDEX DE ${this.profileName.toUpperCase()}`);

        const pokedex = this.profile?.pokedex || {};
        const seen = (pokedex.seenIds || []).length;
        const caught = (pokedex.caughtIds || []).length;
        this.content.add(this.text(x + 18, y + 46, `VUS  ${seen}      PRIS  ${caught}`, 10));

        const list = this.getCaughtList();
        const perPage = POKEDEX_COLUMNS * POKEDEX_ROWS;
        const pageItems = list.slice(this.page * perPage, (this.page + 1) * perPage);
        const columnWidth = (width - 36) / POKEDEX_COLUMNS;

        if (!pageItems.length) {
            this.content.add(this.text(x + 18, y + 90, "Aucun Pokémon vu pour l'instant.", 9, COLORS.muted));
        }
        pageItems.forEach((entry, itemIndex) => {
            const column = Math.floor(itemIndex / POKEDEX_ROWS);
            const row = itemIndex % POKEDEX_ROWS;
            const label = `${entry.caught ? "●" : "○"} ${String(entry.id).padStart(3, "0")} ${entry.name}`;
            this.content.add(this.text(
                x + 18 + column * columnWidth,
                y + 82 + row * 30,
                label.length > 19 ? `${label.slice(0, 18)}.` : label,
                8,
                entry.caught ? COLORS.text : COLORS.muted
            ));
        });

        const team = (this.profile?.team || []).map((pokemon) => `${pokemon.name} N.${pokemon.level}`).join("  ");
        this.content.add(this.text(x + 18, y + height - 50, `ÉQUIPE : ${team || "-"}`, 8));
        const pages = this.getPokedexPageCount();
        const footer = pages > 1 ? `◄ ► page ${this.page + 1}/${pages}    B : retour` : "B : retour";
        this.content.add(this.text(x + width - 18, y + height - 24, footer, 8, COLORS.muted).setOrigin(1, 0));
    }

    renderBadges() {
        this.content.removeAll(true);
        const width = 560;
        const height = 300;
        const x = (VIEW.width - width) / 2;
        const y = (VIEW.height - height) / 2;
        this.panel(x, y, width, height);
        this.header(x, y, width, `BADGES DE ${this.profileName.toUpperCase()}`);

        const badges = this.profile?.badges?.length ? this.profile.badges : Array.from({ length: 8 }, (_, i) => ({ name: `Badge ${i + 1}`, earned: false }));
        const earnedCount = badges.filter((badge) => badge.earned).length;
        this.content.add(this.text(x + 18, y + 46, `${earnedCount} / ${badges.length} badges`, 10));

        badges.forEach((badge, badgeIndex) => {
            const column = badgeIndex % 4;
            const row = Math.floor(badgeIndex / 4);
            const cx = x + 80 + column * 133;
            const cy = y + 120 + row * 96;
            const shape = this.scene.add.graphics();
            if (badge.earned) {
                shape.fillStyle(BADGE_COLORS[badgeIndex % BADGE_COLORS.length], 1);
                shape.lineStyle(3, COLORS.border, 1);
                shape.fillCircle(cx, cy, 22);
                shape.strokeCircle(cx, cy, 22);
                shape.fillStyle(0xffffff, 0.6);
                shape.fillCircle(cx - 7, cy - 7, 6);
            } else {
                shape.lineStyle(2, 0xb8b0a0, 1);
                shape.strokeCircle(cx, cy, 22);
            }
            this.content.add(shape);
            const name = badge.name.replace(/^Badge /, "").replace(/ Badge$/, "");
            this.content.add(this.text(cx, cy + 32, name, 7, badge.earned ? COLORS.text : COLORS.muted).setOrigin(0.5, 0));
        });
        this.content.add(this.text(x + width - 18, y + height - 24, "B : retour", 8, COLORS.muted).setOrigin(1, 0));
    }

    wrap(message, width) {
        const words = String(message || "").split(/\s+/).filter(Boolean);
        const lines = [];
        let current = "";
        words.forEach((word) => {
            const candidate = current ? `${current} ${word}` : word;
            if (candidate.length > width && current) {
                lines.push(current);
                current = word;
            } else {
                current = candidate;
            }
        });
        if (current) {
            lines.push(current);
        }
        return lines;
    }
}
