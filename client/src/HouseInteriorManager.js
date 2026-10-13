// Interior of the houses players can walk into. Every house shares the "house" tilemap
// (walls + furniture collisions); this draws the furniture on top of it, with colors
// that change from one house to another.
//
// A house map is named "house@<outdoor map>@<door x>@<door y>" (door in tiles), so
// saving, multiplayer and the way out all know which house the player is in.

const TILE = 32;
export const HOUSE_TILEMAP = "house";
const HOUSE_PREFIX = "house@";

// World-layer tiles drawn as doors on the outdoor maps.
const DOOR_TILES = new Set([444, 454, 551, 557, 651, 658, 663]);

const PALETTES = [
    { wall: 0xf0d8a8, wallBand: 0xc89858, floorA: 0xc89060, floorB: 0xb88050, rug: 0x5878c8, blanket: 0xd85050 },
    { wall: 0xc8e0c0, wallBand: 0x78a870, floorA: 0xd8b888, floorB: 0xc8a878, rug: 0xc85878, blanket: 0x5890d0 },
    { wall: 0xd8d0f0, wallBand: 0x9888c8, floorA: 0xb89068, floorB: 0xa88058, rug: 0x58a868, blanket: 0xe8b040 },
    { wall: 0xf0c8c0, wallBand: 0xc87870, floorA: 0xd0a878, floorB: 0xc09868, rug: 0x7058a8, blanket: 0x48a8a0 }
];

export function isHouseMap(mapName) {
    return typeof mapName === "string" && mapName.startsWith(HOUSE_PREFIX);
}

export function tilemapKeyFor(mapName) {
    return isHouseMap(mapName) ? HOUSE_TILEMAP : mapName;
}

function parseHouse(mapName) {
    const [, outdoorMap, doorX, doorY] = mapName.split("@");
    return { outdoorMap, doorX: Number(doorX), doorY: Number(doorY) };
}

/**
 * Door zones for an outdoor map, in the same shape as the "Worlds" objects of Tiled.
 * Doors already covered by a Tiled warp (the Pokémon Centers) are skipped.
 */
export function findHouseDoors(scene) {
    const worldLayer = scene.worldLayer;
    const tiledWarps = scene.map.getObjectLayer("Worlds")?.objects || [];
    const doors = [];

    worldLayer.forEachTile((tile) => {
        if (!DOOR_TILES.has(tile.index)) {
            return;
        }

        // Zone on the ground just below the door: the player's feet reach 38px below it when
        // walking into the wall, and land 50px below it when leaving the house.
        const zone = { x: (tile.x * TILE) - 16, y: (tile.y + 1) * TILE, width: TILE + 32, height: 44 };
        const coveredByWarp = tiledWarps.some((warp) => zone.x + 16 < warp.x + warp.width
            && zone.x + zone.width - 16 > warp.x
            && zone.y < warp.y + warp.height
            && zone.y + zone.height > warp.y);

        if (coveredByWarp) {
            return;
        }

        doors.push({
            ...zone,
            name: `${HOUSE_PREFIX}${scene.mapName}@${tile.x}@${tile.y}`,
            properties: [
                { name: "playerTexturePosition", value: "back" },
                { name: "spawnPoint", value: "from-exterior" }
            ]
        });
    });

    return doors;
}

/** Where to go when leaving a house: back on the outdoor map, just below its door. */
export function houseExitFor(mapName) {
    const { outdoorMap, doorX, doorY } = parseHouse(mapName);
    return {
        map: outdoorMap,
        playerTexturePosition: "front",
        // Feet land just below the door zone, so the player does not walk straight back in.
        playerPosition: { x: (doorX * TILE) + 16, y: ((doorY + 1) * TILE) + 20 }
    };
}

export default class HouseInteriorManager {
    constructor(scene) {
        this.scene = scene;
        this.active = isHouseMap(scene.mapName);

        if (!this.active) {
            return;
        }

        const { doorX, doorY } = parseHouse(scene.mapName);
        this.palette = PALETTES[Math.abs((doorX * 7) + (doorY * 13)) % PALETTES.length];

        // The house tilemap only carries collisions: everything visible is drawn here.
        scene.belowLayer.setVisible(false);
        scene.worldLayer.setVisible(false);
        scene.aboveLayer.setVisible(false);

        this.root = scene.add.container(0, 0).setDepth(3);
        this.draw();
    }

    destroy() {
        if (this.root) {
            this.root.destroy(true);
            this.root = null;
        }
    }

    draw() {
        const g = this.scene.add.graphics();
        const p = this.palette;
        const width = this.scene.map.widthInPixels;
        const height = this.scene.map.heightInPixels;
        this.root.add(g);

        // Floor planks
        for (let y = 2; y < this.scene.map.height; y += 1) {
            for (let x = 0; x < this.scene.map.width; x += 1) {
                g.fillStyle((x + (y % 2)) % 2 === 0 ? p.floorA : p.floorB, 1);
                g.fillRect(x * TILE, y * TILE, TILE, TILE);
                g.fillStyle(0x000000, 0.12);
                g.fillRect(x * TILE, (y * TILE) + TILE - 2, TILE, 2);
            }
        }

        // Back wall with a band and two windows
        g.fillStyle(p.wall, 1);
        g.fillRect(0, 0, width, TILE * 2);
        g.fillStyle(p.wallBand, 1);
        g.fillRect(0, (TILE * 2) - 10, width, 10);
        drawWindow(g, TILE * 2.2, TILE * 0.4);
        drawWindow(g, TILE * 5.3, TILE * 0.4);

        // Side walls
        g.fillStyle(p.wallBand, 1);
        g.fillRect(0, TILE * 2, 10, height - (TILE * 2));
        g.fillRect(width - 10, TILE * 2, 10, height - (TILE * 2));

        // Rug in the middle, door mat at the exit
        g.fillStyle(p.rug, 1);
        g.fillRect(TILE * 2.5, TILE * 3.6, TILE * 3, TILE * 2.2);
        g.fillStyle(0xffffff, 0.35);
        g.strokeRect(TILE * 2.5 + 4, TILE * 3.6 + 4, (TILE * 3) - 8, (TILE * 2.2) - 8);
        g.fillStyle(0x9a3a2a, 1);
        g.fillRect((TILE * 4) + 8, height - TILE + 6, TILE * 2 - 16, TILE - 10);

        // Bed (1,2)-(1,3)
        g.fillStyle(0x8a5a32, 1);
        g.fillRect(TILE + 2, (TILE * 2) + 2, TILE - 4, (TILE * 2) - 4);
        g.fillStyle(0xffffff, 1);
        g.fillRect(TILE + 5, (TILE * 2) + 5, TILE - 10, 12);
        g.fillStyle(p.blanket, 1);
        g.fillRect(TILE + 4, (TILE * 2) + 20, TILE - 8, TILE + 8);

        // Bookshelf (3,2)-(4,2)
        g.fillStyle(0x6a4428, 1);
        g.fillRect(TILE * 3, (TILE * 2) - 18, TILE * 2, TILE + 16);
        const books = [0xd04040, 0x4060c8, 0x40a058, 0xe0b030, 0x9050b0];
        for (let shelf = 0; shelf < 2; shelf += 1) {
            for (let i = 0; i < 9; i += 1) {
                g.fillStyle(books[(i + shelf) % books.length], 1);
                g.fillRect((TILE * 3) + 4 + (i * 6.5), (TILE * 2) - 14 + (shelf * 22), 5, 16);
            }
        }

        // TV on its cabinet (7,2)
        g.fillStyle(0x5a3a22, 1);
        g.fillRect((TILE * 7) + 2, (TILE * 2) + 14, TILE - 4, 16);
        g.fillStyle(0x303038, 1);
        g.fillRect((TILE * 7) + 3, (TILE * 2) - 10, TILE - 6, 24);
        g.fillStyle(0x70b8e8, 1);
        g.fillRect((TILE * 7) + 6, (TILE * 2) - 7, TILE - 12, 17);

        // Plant (8,2) and (1,7)
        drawPlant(g, TILE * 8, TILE * 2);
        drawPlant(g, TILE, TILE * 7);

        // Table with two chairs (6,5)-(7,5)
        g.fillStyle(0x7a4e2c, 1);
        g.fillRect((TILE * 5) + 26, (TILE * 5) + 2, 6, TILE - 6);
        g.fillRect((TILE * 8), (TILE * 5) + 2, 6, TILE - 6);
        g.fillStyle(0xa86c3c, 1);
        g.fillRect((TILE * 6) + 2, (TILE * 5) - 4, (TILE * 2) - 4, TILE);
        g.fillStyle(0xffffff, 0.8);
        g.fillCircle((TILE * 7), (TILE * 5) + 10, 6);
    }
}

function drawWindow(g, x, y) {
    g.fillStyle(0xffffff, 1);
    g.fillRect(x, y, 40, 30);
    g.fillStyle(0x88c8f0, 1);
    g.fillRect(x + 3, y + 3, 16, 24);
    g.fillRect(x + 21, y + 3, 16, 24);
}

function drawPlant(g, x, y) {
    g.fillStyle(0xb06030, 1);
    g.fillRect(x + 8, y + 18, 16, 12);
    g.fillStyle(0x3a9a48, 1);
    g.fillCircle(x + 16, y + 12, 10);
    g.fillStyle(0x58c060, 1);
    g.fillCircle(x + 11, y + 9, 5);
    g.fillCircle(x + 21, y + 10, 5);
}
