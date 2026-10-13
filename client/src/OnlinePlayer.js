import Phaser from "phaser";
import { ENTITY_SIZE } from "./constants/entity";
import { OTHER_PLAYER_NICKNAME_STYLE } from "./constants/nickname";

export default class OnlinePlayer extends Phaser.GameObjects.Sprite {
    constructor(config) {
        super(config.scene, config.x, config.y, config.playerId);

        this.scene.add.existing(this);
        this.scene.physics.world.enableBody(this);
        this.scene.physics.add.collider(this, config.worldLayer);

        this.setTexture("players", "bob_front.png");
        this.setDisplaySize(ENTITY_SIZE.width, ENTITY_SIZE.height);
        this.setDepth(5);

        this.map = config.map;
        console.log(`Map of ${config.playerId} is ${this.map}`);

        // Player Offset
        this.body.setSize(ENTITY_SIZE.hitboxWidth, ENTITY_SIZE.hitboxHeight);
        this.body.setOffset(0, ENTITY_SIZE.hitboxOffsetY);

        // Display the player's chosen name above them
        this.playerNickname = this.scene.add.text(this.x, this.y, config.name || "Dresseur", OTHER_PLAYER_NICKNAME_STYLE)
            .setOrigin(0.5, 1)
            .setDepth(20);
        this.followNickname = () => this.updateNicknamePosition();
        this.scene.events.on("postupdate", this.followNickname);
        this.updateNicknamePosition();
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
        this.anims.play(`onlinePlayer-${position}-walk`, true);
        this.setPosition(x, y);
    }

    stopWalking(position) {
        this.anims.stop();
        this.setTexture("players", `bob_${position}.png`);
    }

    destroy() {
        if (this.scene) {
            this.scene.events.off("postupdate", this.followNickname);
        }
        this.playerNickname.destroy();
        super.destroy();
    }
}
