import * as Phaser from "phaser";
import { Minigame1Scene } from "@/game/scenes/minigame1-scene";
import { PreloadScene } from "@/game/scenes/preload-scene";

export function createGameConfig(parent: HTMLDivElement): Phaser.Types.Core.GameConfig {
	return {
		type: Phaser.AUTO,
		parent,
		backgroundColor: "#030711",
		width: 960,
		height: 540,
		render: {
			antialias: true,
			pixelArt: false,
		},
		scale: {
			mode: Phaser.Scale.FIT,
			autoCenter: Phaser.Scale.CENTER_BOTH,
		},
		scene: [PreloadScene, Minigame1Scene],
	};
}