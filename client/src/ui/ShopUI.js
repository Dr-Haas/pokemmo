import Phaser from "phaser";
import { addBagItem, addMoney, getItemDefinition, getItemQuantity, getMoney } from "../state/gameState";
import { PRICES } from "../data/story";

// Poké Mart counter: pick an item, choose how many (UP/DOWN +-1, LEFT/RIGHT +-10), buy.
// open() resolves when the player leaves the shop.

const FONT_FAMILY = "\"Press Start 2P\"";
const COLORS = {
    panel: 0xf8f8f8,
    border: 0x4870b8,
    text: "#303030",
    muted: "#8a8a8a",
    cursor: "#e03030"
};
const ROW = 30;

export default class ShopUI {
    constructor(scene) {
        this.scene = scene;
        this.visible = false;
        this.mode = "list";
        this.index = 0;
        this.quantity = 1;

        this.keys = scene.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.UP,
            down: Phaser.Input.Keyboard.KeyCodes.DOWN,
            left: Phaser.Input.Keyboard.KeyCodes.LEFT,
            right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
            enter: Phaser.Input.Keyboard.KeyCodes.ENTER,
            z: Phaser.Input.Keyboard.KeyCodes.Z,
            x: Phaser.Input.Keyboard.KeyCodes.X,
            escape: Phaser.Input.Keyboard.KeyCodes.ESC
        });

        this.root = scene.add.container(0, 0).setScrollFactor(0).setDepth(1160).setVisible(false);
        const g = scene.add.graphics();
        g.fillStyle(COLORS.panel, 1).fillRoundedRect(24, 20, 480, 300, 8);
        g.lineStyle(4, COLORS.border, 1).strokeRoundedRect(24, 20, 480, 300, 8);
        g.fillStyle(COLORS.panel, 1).fillRoundedRect(520, 20, 256, 70, 8);
        g.lineStyle(4, COLORS.border, 1).strokeRoundedRect(520, 20, 256, 70, 8);
        g.fillStyle(COLORS.panel, 1).fillRoundedRect(24, 332, 752, 100, 8);
        g.lineStyle(4, COLORS.border, 1).strokeRoundedRect(24, 332, 752, 100, 8);
        this.root.add(g);

        this.moneyText = this.text(538, 34, "", 9);
        this.ownedText = this.text(538, 62, "", 8, COLORS.muted);
        this.descriptionText = this.text(44, 350, "", 9).setWordWrapWidth(712).setLineSpacing(10);
        this.cursor = this.text(42, 44, "►", 10, COLORS.cursor);
        this.footer = this.text(44, 298, "A : ACHETER   B : SORTIR", 7, COLORS.muted);
        this.root.add([this.moneyText, this.ownedText, this.descriptionText, this.cursor, this.footer]);
        this.rows = [];

        // Quantity box
        this.quantityBox = scene.add.container(0, 0).setVisible(false);
        const q = scene.add.graphics();
        q.fillStyle(COLORS.panel, 1).fillRoundedRect(520, 210, 256, 110, 8);
        q.lineStyle(4, COLORS.border, 1).strokeRoundedRect(520, 210, 256, 110, 8);
        this.quantityText = this.text(540, 228, "", 10);
        this.totalText = this.text(540, 262, "", 9);
        this.quantityHelp = this.text(540, 294, "HAUT/BAS : NOMBRE", 6, COLORS.muted);
        this.quantityBox.add([q, this.quantityText, this.totalText, this.quantityHelp]);
        this.root.add(this.quantityBox);
    }

    text(x, y, value, size, color = COLORS.text) {
        return this.scene.add.text(x, y, value, { fontFamily: FONT_FAMILY, fontSize: `${size}px`, color });
    }

    destroy() {
        this.root.destroy(true);
    }

    isOpen() {
        return this.visible;
    }

    /** Opens the shop with these item ids; onMessage(text) shows the clerk's answers. */
    open(itemIds, { onMessage }) {
        this.items = itemIds.map((id) => ({ ...getItemDefinition(id), price: PRICES[id] || 100 })).filter((item) => item.id);
        this.items.push({ id: "__exit__", name: "Sortir" });
        this.onMessage = onMessage;
        this.index = 0;
        this.mode = "list";
        this.buildRows();
        this.visible = true;
        this.root.setVisible(true);
        this.refresh();
        this.scene.input.keyboard.resetKeys();
        return new Promise((resolve) => {
            this.resolve = resolve;
        });
    }

    buildRows() {
        this.rows.forEach((row) => row.forEach((part) => part.destroy()));
        this.rows = this.items.map((item, index) => {
            const y = 44 + (index * ROW);
            const name = this.text(68, y, item.name, 10)
                .setScrollFactor(0)
                .setInteractive({ useHandCursor: true })
                .on("pointerdown", () => {
                    if (!this.visible || this.busy) {
                        return;
                    }
                    if (this.mode === "list") {
                        this.index = index;
                        this.choose();
                    }
                });
            const price = this.text(484, y, item.price ? `${item.price} $` : "", 10).setOrigin(1, 0);
            this.root.add([name, price]);
            return [name, price];
        });
    }

    refresh() {
        const item = this.items[this.index];
        this.moneyText.setText(`ARGENT : ${getMoney()} $`);
        this.ownedText.setText(item.price ? `Dans le sac : ${getItemQuantity(item.id)}` : "");
        this.descriptionText.setText(item.desc || "À bientôt !");
        this.cursor.setY(44 + (this.index * ROW));
        this.quantityBox.setVisible(this.mode === "quantity");
        if (this.mode === "quantity") {
            this.quantityText.setText(`x ${String(this.quantity).padStart(2, "0")}`);
            this.totalText.setText(`${item.price * this.quantity} $`);
        }
    }

    update() {
        if (!this.visible || this.busy) {
            return;
        }
        const just = (key) => Phaser.Input.Keyboard.JustDown(this.keys[key]);
        const confirm = just("z") || just("enter");
        const cancel = just("x") || just("escape");

        if (this.mode === "list") {
            if (just("up")) {
                this.index = Phaser.Math.Wrap(this.index - 1, 0, this.items.length);
            } else if (just("down")) {
                this.index = Phaser.Math.Wrap(this.index + 1, 0, this.items.length);
            } else if (confirm) {
                this.choose();
                return;
            } else if (cancel) {
                this.close();
                return;
            }
            this.refresh();
            return;
        }

        const item = this.items[this.index];
        const most = Math.max(1, Math.min(99, Math.floor(getMoney() / item.price)));
        if (just("up")) {
            this.quantity = this.quantity >= most ? 1 : this.quantity + 1;
        } else if (just("down")) {
            this.quantity = this.quantity <= 1 ? most : this.quantity - 1;
        } else if (just("right")) {
            this.quantity = Math.min(most, this.quantity + 10);
        } else if (just("left")) {
            this.quantity = Math.max(1, this.quantity - 10);
        } else if (confirm) {
            this.buy(item, this.quantity);
            return;
        } else if (cancel) {
            this.mode = "list";
        }
        this.refresh();
    }

    choose() {
        const item = this.items[this.index];
        if (item.id === "__exit__") {
            this.close();
            return;
        }
        if (getMoney() < item.price) {
            this.say("Tu n'as pas assez d'argent.");
            return;
        }
        this.mode = "quantity";
        this.quantity = 1;
        this.refresh();
    }

    async buy(item, quantity) {
        const total = item.price * quantity;
        this.mode = "list";
        if (getMoney() < total) {
            await this.say("Tu n'as pas assez d'argent.");
            return;
        }
        addMoney(-total);
        addBagItem(item.id, quantity);
        // Ten Poké Balls at once: one more as a gift, like the Honor Ball in the games.
        if (item.id === "poke-ball" && quantity >= 10) {
            addBagItem("poke-ball", 1);
            await this.say(`Voici tes ${item.name} x${quantity}, plus une en cadeau ! Merci !`);
        } else {
            await this.say(`Voici : ${item.name} x${quantity}. Merci !`);
        }
        this.refresh();
    }

    async say(message) {
        this.busy = true;
        this.root.setVisible(false);
        await this.onMessage(message);
        this.root.setVisible(true);
        this.busy = false;
        this.refresh();
        this.scene.input.keyboard.resetKeys();
    }

    close() {
        this.visible = false;
        this.root.setVisible(false);
        this.scene.input.keyboard.resetKeys();
        const resolve = this.resolve;
        this.resolve = null;
        if (resolve) {
            resolve();
        }
    }
}
