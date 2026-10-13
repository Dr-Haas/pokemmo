import Phaser from "phaser";
import { applyEntitySize } from "./constants/entity";
import { OTHER_PLAYER_NICKNAME_STYLE } from "./constants/nickname";
import { CHARACTER_ATLAS, standingFrame, walkAnimation } from "./characters";

export default class OnlinePlayer extends Phaser.GameObjects.Sprite {
    constructor(config) {
        super(config.scene, config.x, config.y, config.playerId);

        this.scene.add.existing(this);
        this.scene.physics.world.enableBody(this);
        this.scene.physics.add.collider(this, config.worldLayer);

        this.character = config.character;
        this.setTexture(CHARACTER_ATLAS, standingFrame(this.character, "front"));
        this.setDepth(5);

        this.map = config.map;
        console.log(`Map of ${config.playerId} is ${this.map}`);

        // Player Offset
        applyEntitySize(this);

        // Display the player's chosen name above them
        this.playerNickname = this.scene.add.text(this.x, this.y, config.name || "Dresseur", OTHER_PLAYER_NICKNAME_STYLE)
            .setOrigin(0.5, 1)
            .setDepth(20);
        this.followNickname = () => this.updateNicknamePosition();
        this.scene.events.on("postupdate", this.followNickname);
        this.updateNicknamePosition();
    }

    setCharacter(character) {
        if (character && character !== this.character) {
            this.character = character;
            this.setTexture(CHARACTER_ATLAS, standingFrame(character, "front"));
            applyEntitySize(this);
        }
    }

    setName(name) {
        if (name && this.playerNickname.text !== name) {
            this.playerNickname.setText(name);
        }
    }

    updateNicknamePosition() {
        this.playerNickname.x = Math.round(this.x);
        this.playerNickname.y = Math.round(this.y - (this.displayHeight / 2));
    }

    isWalking(position, x, y) {
        this.anims.play(walkAnimation(this.character, position), true);
        this.setPosition(x, y);
    }

    stopWalking(position) {
        this.anims.stop();
        this.setTexture(CHARACTER_ATLAS, standingFrame(this.character, position));
    }

    destroy() {
        if (this.scene) {
            this.scene.events.off("postupdate", this.followNickname);
        }
        this.playerNickname.destroy();
        super.destroy();
    }
}
