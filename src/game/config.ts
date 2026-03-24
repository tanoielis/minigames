import * as Phaser from "phaser";
import { Minigame1Scene } from "@/game/scenes/minigame1-scene";
import { Minigame2Scene } from "@/game/scenes/minigame2-scene";
import { Minigame3Scene } from "@/game/scenes/minigame3-scene";
import { Minigame4Scene } from "@/game/scenes/minigame4-scene";
import { Minigame5Scene } from "@/game/scenes/minigame5-scene";
import { Minigame6Scene } from "@/game/scenes/minigame6-scene";
import { PreloadScene } from "@/game/scenes/preload-scene";

export function createGameConfig(parent: HTMLDivElement, startSceneKey: string): Phaser.Types.Core.GameConfig {
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
		scene: [PreloadScene, Minigame1Scene, Minigame2Scene, Minigame3Scene, Minigame4Scene, Minigame5Scene, Minigame6Scene],
		callbacks: {
			preBoot: (game) => {
				game.registry.set("startSceneKey", startSceneKey);
			},
		},
	};
}