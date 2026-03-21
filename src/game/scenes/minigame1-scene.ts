import * as Phaser from "phaser";
import { GAME_EVENTS, gameEventBus } from "@/game/event-bus";

export class Minigame1Scene extends Phaser.Scene {
	constructor() {
		super("minigame1");
	}

	create() {
		const { width, height } = this.scale;

		this.cameras.main.setBackgroundColor("#050b16");

		this.add
			.text(width / 2, 72, "MINIGAME 1", {
				fontFamily: "Arial",
				fontSize: "28px",
				color: "#d9fbff",
			})
			.setOrigin(0.5);

		this.add.rectangle(width / 2, height / 2, 320, 180, 0x18d9ff, 1).setStrokeStyle(4, 0x8ef7ff, 1);

		gameEventBus.emit(GAME_EVENTS.SCENE_READY, {
			sceneKey: "Minigame 1",
		});
	}
}