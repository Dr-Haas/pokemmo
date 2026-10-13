import { KANTO_GRID, KANTO_LAND, KANTO_PLACES, KANTO_ROADS, placeForMap } from "../data/kanto";

// Menu > Carte: the Kanto region, Rouge Feu style. Playable places are in color,
// the ones still to come are grey, and the player's position blinks.

const FONT_FAMILY = "\"Press Start 2P\"";
const CELL = 21;
const MAP_X = 18;
const MAP_Y = 40;
const COLORS = {
    panel: 0x2848c8,
    border: 0x2c2c2c,
    sea: 0x4878d8,
    seaLine: 0x6890e8,
    land: 0x68b858,
    landEdge: 0x387830,
    road: 0xf0d878,
    roadLocked: 0x98a888,
    city: 0xe03838,
    cityLocked: 0x8c8c8c,
    area: 0x2c8838,
    marker: 0xf8d800,
    infoBackground: 0xf0ead8,
    text: "#2c2c2c",
    textOnBlue: "#ffffff",
    textMuted: "#7a7a7a"
};

const byId = Object.fromEntries(KANTO_PLACES.map((place) => [place.id, place]));
const SELECTABLE = KANTO_PLACES;

function centerOf(place) {
    return { x: MAP_X + (place.x * CELL) + (CELL / 2), y: MAP_Y + (place.y * CELL) + (CELL / 2) };
}

function pointAt([x, y]) {
    return { x: MAP_X + (x * CELL) + (CELL / 2), y: MAP_Y + (y * CELL) + (CELL / 2) };
}

export default class TownMapScreen {
    constructor(scene, { onClose }) {
        this.scene = scene;
        this.onClose = onClose;
        this.index = 0;
        this.here = null;

        this.container = scene.add.container(32, 18).setVisible(false);
        const panel = scene.add.graphics();
        panel.fillStyle(COLORS.panel, 1).lineStyle(3, COLORS.border, 1);
        panel.fillRoundedRect(0, 0, 736, 406, 4).strokeRoundedRect(0, 0, 736, 406, 4);
        this.container.add(panel);
        this.container.add(this.text(18, 14, "CARTE DE KANTO", 10, COLORS.textOnBlue));

        this.container.add(this.drawRegion());
        this.marks = scene.add.graphics();
        this.container.add(this.marks);

        const info = scene.add.graphics();
        info.fillStyle(COLORS.infoBackground, 1).lineStyle(3, COLORS.border, 1);
        info.fillRoundedRect(496, 40, 222, 336, 4).strokeRoundedRect(496, 40, 222, 336, 4);
        this.container.add(info);
        this.hereText = this.text(510, 54, "", 7).setWordWrapWidth(196).setLineSpacing(6);
        this.nameText = this.text(510, 116, "", 9).setWordWrapWidth(196).setLineSpacing(6);
        this.kindText = this.text(510, 150, "", 7, COLORS.textMuted);
        this.descriptionText = this.text(510, 178, "", 7).setWordWrapWidth(196).setLineSpacing(8);
        this.container.add([this.hereText, this.nameText, this.kindText, this.descriptionText]);

        const back = this.text(18, 384, "HAUT/BAS : LIEU   X : RETOUR", 8, COLORS.textOnBlue)
            .setScrollFactor(0)
            .setInteractive({ useHandCursor: true })
            .on("pointerdown", () => this.isOpen() && this.onClose());
        this.container.add(back);

        // Tapping a place on the map selects it.
        SELECTABLE.forEach((place, index) => {
            const { x, y } = centerOf(place);
            const hit = scene.add.zone(x, y, CELL * 1.6, CELL * 1.6)
                .setScrollFactor(0)
                .setInteractive({ useHandCursor: true })
                .on("pointerdown", () => {
                    if (this.isOpen()) {
                        this.index = index;
                        this.refresh(true);
                    }
                });
            this.container.add(hit);
        });
    }

    text(x, y, value, size, color = COLORS.text) {
        return this.scene.add.text(x, y, value, { fontFamily: FONT_FAMILY, fontSize: `${size}px`, color });
    }

    drawRegion() {
        const g = this.scene.add.graphics();
        const width = KANTO_GRID.columns * CELL;
        const height = KANTO_GRID.rows * CELL;

        g.fillStyle(COLORS.sea, 1).fillRect(MAP_X, MAP_Y, width, height);
        g.lineStyle(1, COLORS.seaLine, 1);
        for (let row = 0; row < KANTO_GRID.rows; row += 2) {
            g.lineBetween(MAP_X, MAP_Y + (row * CELL) + 10, MAP_X + width, MAP_Y + (row * CELL) + 10);
        }

        KANTO_LAND.forEach(([x, y, w, h]) => {
            g.fillStyle(COLORS.landEdge, 1).fillRect(MAP_X + (x * CELL) - 3, MAP_Y + (y * CELL) - 3, (w * CELL) + 6, (h * CELL) + 6);
        });
        KANTO_LAND.forEach(([x, y, w, h]) => {
            g.fillStyle(COLORS.land, 1).fillRect(MAP_X + (x * CELL), MAP_Y + (y * CELL), w * CELL, h * CELL);
        });

        KANTO_ROADS.forEach(([from, to, bend]) => {
            const a = byId[from];
            const b = byId[to];
            const open = Boolean(a.map && b.map);
            const points = [centerOf(a), ...(bend ? [pointAt(bend)] : []), centerOf(b)];
            g.lineStyle(open ? 7 : 5, open ? COLORS.road : COLORS.roadLocked, 1);
            for (let i = 1; i < points.length; i += 1) {
                g.lineBetween(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
            }
        });

        KANTO_PLACES.forEach((place) => {
            const { x, y } = centerOf(place);
            if (place.kind === "route") {
                return;
            }
            if (place.kind === "area") {
                g.fillStyle(COLORS.area, 1).fillCircle(x, y, 8);
                g.lineStyle(2, COLORS.border, 1).strokeCircle(x, y, 8);
                return;
            }
            g.fillStyle(place.map ? COLORS.city : COLORS.cityLocked, 1).fillRect(x - 8, y - 8, 16, 16);
            g.lineStyle(2, COLORS.border, 1).strokeRect(x - 8, y - 8, 16, 16);
        });

        return g;
    }

    isOpen() {
        return this.container.visible;
    }

    show(mapName) {
        this.here = placeForMap(mapName);
        this.index = Math.max(0, SELECTABLE.indexOf(this.here));
        this.container.setVisible(true);
        this.refresh(true);
    }

    hide() {
        this.container.setVisible(false);
    }

    move(step) {
        this.index = (this.index + step + SELECTABLE.length) % SELECTABLE.length;
        this.refresh(true);
    }

    refresh(blinkOn) {
        const place = SELECTABLE[this.index];
        this.marks.clear();

        // Where the player is: a blinking yellow ring.
        if (this.here && blinkOn) {
            const { x, y } = centerOf(this.here);
            this.marks.lineStyle(3, COLORS.marker, 1).strokeCircle(x, y, 13);
        }

        // Selected place: white corners around it.
        const { x, y } = centerOf(place);
        this.marks.lineStyle(2, 0xffffff, 1).strokeRect(x - 12, y - 12, 24, 24);

        // The pixel font has no capital accented letters (Forêt, Céladopole): names keep their case.
        this.hereText.setText(`Tu es ici :\n${this.here ? this.here.label : "?"}`);
        this.nameText.setText(place.label);
        this.kindText.setText({ city: "VILLE", route: "ROUTE", area: "LIEU" }[place.kind] || "");
        this.descriptionText.setText(place.map ? place.text : "Pas encore accessible. Cette ville arrivera bientôt !");
        this.descriptionText.setColor(place.map ? COLORS.text : COLORS.textMuted);
    }
}
