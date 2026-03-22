import * as Phaser from "phaser";

export class PreloadScene extends Phaser.Scene {
	constructor() {
		super("preload");
	}

	preload() {
		const { width, height } = this.scale;
		const progressBox = this.add.graphics();
		const progressBar = this.add.graphics();

		this.cameras.main.setBackgroundColor("#030711");

		progressBox.fillStyle(0x102033, 0.9);
		progressBox.fillRoundedRect(width * 0.2, height * 0.48, width * 0.6, 28, 8);

		const loadingLabel = this.add
			.text(width / 2, height * 0.42, "Loading CYBER Minigames", {
				fontFamily: "Arial",
				fontSize: "24px",
				color: "#c4f9ff",
			})
			.setOrigin(0.5);

		const percentText = this.add
			.text(width / 2, height * 0.56, "0%", {
				fontFamily: "Arial",
				fontSize: "18px",
				color: "#8eeaff",
			})
			.setOrigin(0.5);

		this.load.on("progress", (value: number) => {
			progressBar.clear();
			progressBar.fillStyle(0x1cf2ff, 1);
			progressBar.fillRoundedRect(width * 0.21, height * 0.49, width * 0.58 * value, 10, 6);
			percentText.setText(`${Math.round(value * 100)}%`);
		});

		this.load.once("complete", () => {
			progressBar.destroy();
			progressBox.destroy();
			loadingLabel.destroy();
			percentText.destroy();
		});

		this.load.image("minigame1-thumb", "/minigames/minigame1-thumbnail.svg");
		this.load.image("minigame2-thumb", "/minigames/minigame2-thumbnail.svg");
		this.load.image("minigame3-thumb", "/minigames/minigame3-thumbnail.svg");
		this.load.image("next-mark", "/next.svg");
		this.load.image("globe-icon", "/globe.svg");
		this.load.image("file-icon", "/file.svg");
	}

	create() {
		const startSceneKey = this.registry.get("startSceneKey") ?? "minigame1";
		this.scene.start(startSceneKey);
	}
}