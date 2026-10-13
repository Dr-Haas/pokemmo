import Phaser from "phaser";
import TownJSON from "./assets/tilemaps/town.json";
import Route1JSON from "./assets/tilemaps/route1.json";
import ViridianJSON from "./assets/tilemaps/viridian.json";
import Route2JSON from "./assets/tilemaps/route2.json";
import ViridianForestJSON from "./assets/tilemaps/viridian_forest.json";
import PewterJSON from "./assets/tilemaps/pewter.json";
import PokemonCenterViridianJSON from "./assets/tilemaps/pokemon_center_viridian.json";
import PokemonCenterPewterJSON from "./assets/tilemaps/pokemon_center_pewter.json";
import HouseJSON from "./assets/tilemaps/house.json";
import HallJSON from "./assets/tilemaps/hall.json";
import TilesTown from "./assets/tilesets/tuxmon-sample-32px-extruded.png";

import AtlasJSON from "./assets/atlas/atlas";
import AtlasPNG from "./assets/atlas/atlas.png";
import PlayersAtlasJSON from "./assets/atlas/players";
import PlayersAtlasPNG from "./assets/images/players/players.png";
import { getPlayerData, getPokemonSpriteEntries, initializeGameState, setTrainerName, updatePlayerPosition } from "./state/gameState";
import { nameReady, getPlayerName } from "./SocketServer";
import { createCharacterAnimations } from "./characters";
import { ZOOM } from "./ui/theme";

// Bumped when the world map is redrawn: older saved positions no longer make sense.
const KANTO_LAYOUT = 2;

export class Scene1 extends Phaser.Scene {
    constructor() {
        super("bootGame");
    }

    preload() {
        // Kanto, from Bourg Palette to Argenta (built by tools/kanto_maps.py)
        this.load.image("TilesTown", TilesTown);
        this.load.tilemapTiledJSON("town", TownJSON);
        this.load.tilemapTiledJSON("route1", Route1JSON);
        this.load.tilemapTiledJSON("viridian", ViridianJSON);
        this.load.tilemapTiledJSON("route2", Route2JSON);
        this.load.tilemapTiledJSON("viridian_forest", ViridianForestJSON);
        this.load.tilemapTiledJSON("pewter", PewterJSON);
        this.load.tilemapTiledJSON("pokemon_center_viridian", PokemonCenterViridianJSON);
        this.load.tilemapTiledJSON("pokemon_center_pewter", PokemonCenterPewterJSON);
        this.load.tilemapTiledJSON("house", HouseJSON);
        this.load.tilemapTiledJSON("hall", HallJSON);

        // Load atlas
        this.load.atlas("currentPlayer", AtlasPNG, AtlasJSON);
        this.load.atlas("players", PlayersAtlasPNG, PlayersAtlasJSON);
    }

    create() {
        this.cameras.main.setOrigin(0, 0).setZoom(ZOOM);
        this.loadingText = this.add.text(20, 20, "Chargement du jeu...", {
            fontSize: "12px",
            color: "#ffffff"
        });

        this.createAnimations();
        this.bootstrapGame();
    }

    async bootstrapGame() {
        this.loadingText.setText("Chargement du jeu...\nTéléchargement du Pokédex de Kanto");

        // Log in first: the account's game must be on this device before the game reads it.
        await nameReady;
        await Promise.all([
            initializeGameState(),
            waitForPixelFont()
        ]);

        // The trainer card and menus use the name chosen on the name screen.
        setTrainerName(getPlayerName().toUpperCase());

        const spriteEntries = getPokemonSpriteEntries().filter(({ key }) => !this.textures.exists(key));

        if (spriteEntries.length) {
            spriteEntries.forEach(({ key, url }) => {
                this.load.image(key, url);
            });

            this.loadingText.setText("Chargement du jeu...\nPréparation des sprites de combat");
            this.load.once(Phaser.Loader.Events.COMPLETE, () => {
                this.startGame();
            });
            this.load.start();
            return;
        }

        this.startGame();
    }

    startGame() {
        this.loadingText.setText("Chargement du jeu...\nC'est parti !");
        const { position } = getPlayerData();

        // Saves from the old map (Bourg Écho, Ashveld...) start again in front of the house in Bourg Palette.
        if (position.layout !== KANTO_LAYOUT) {
            updatePlayerPosition({ mapId: "town", facing: "front", layout: KANTO_LAYOUT });
            this.scene.start("playGame", { map: "town", playerTexturePosition: "front", spawnPointName: "Spawn Point" });
            return;
        }

        this.scene.start("playGame", {
            map: position.mapId,
            playerTexturePosition: position.facing,
            spawnPointName: "Spawn Point",
            playerPosition: {
                x: position.x,
                y: position.y
            }
        });
    }

    createAnimations() {
        // Every pickable character, for the local and the online players.
        createCharacterAnimations(this);

        // Create the player's walking animations from the texture currentPlayer. These are stored in the global
        // animation manager so any sprite can access them.
        this.anims.create({
            key: "misa-left-walk",
            frames: this.anims.generateFrameNames("currentPlayer", {
                prefix: "misa-left-walk.",
                start: 0,
                end: 3,
                zeroPad: 3
            }),
            frameRate: 10,
            repeat: -1
        });
        this.anims.create({
            key: "misa-right-walk",
            frames: this.anims.generateFrameNames("currentPlayer", {
                prefix: "misa-right-walk.",
                start: 0,
                end: 3,
                zeroPad: 3
            }),
            frameRate: 10,
            repeat: -1
        });
        this.anims.create({
            key: "misa-front-walk",
            frames: this.anims.generateFrameNames("currentPlayer", {
                prefix: "misa-front-walk.",
                start: 0,
                end: 3,
                zeroPad: 3
            }),
            frameRate: 10,
            repeat: -1
        });
        this.anims.create({
            key: "misa-back-walk",
            frames: this.anims.generateFrameNames("currentPlayer", {
                prefix: "misa-back-walk.",
                start: 0,
                end: 3,
                zeroPad: 3
            }),
            frameRate: 10,
            repeat: -1
        });

        // onlinePlayer animations
        this.anims.create({
            key: "onlinePlayer-left-walk", frames: this.anims.generateFrameNames("players", {
                start: 0,
                end: 3,
                zeroPad: 3,
                prefix: "bob_left_walk.",
                suffix: ".png"
            }), frameRate: 10, repeat: -1
        });
        this.anims.create({
            key: "onlinePlayer-right-walk", frames: this.anims.generateFrameNames("players", {
                start: 0,
                end: 3,
                zeroPad: 3,
                prefix: "bob_right_walk.",
                suffix: ".png"
            }), frameRate: 10, repeat: -1
        });
        this.anims.create({
            key: "onlinePlayer-front-walk", frames: this.anims.generateFrameNames("players", {
                start: 0,
                end: 3,
                zeroPad: 3,
                prefix: "bob_front_walk.",
                suffix: ".png"
            }), frameRate: 10, repeat: -1
        });
        this.anims.create({
            key: "onlinePlayer-back-walk", frames: this.anims.generateFrameNames("players", {
                start: 0,
                end: 3,
                zeroPad: 3,
                prefix: "bob_back_walk.",
                suffix: ".png"
            }), frameRate: 10, repeat: -1
        });
    }
}

function waitForPixelFont() {
    if (typeof document === "undefined" || !document.fonts) {
        return Promise.resolve();
    }

    return Promise.all([
        document.fonts.load("800 15px \"Nunito\""),
        document.fonts.ready
    ]).catch(() => undefined);
}
