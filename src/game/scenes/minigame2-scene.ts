import * as Phaser from "phaser";
import { GAME_EVENTS, gameEventBus } from "@/game/event-bus";

type Hole = {
	index: number;
	x: number;
	width: number;
	cleared: boolean;
	failed: boolean;
};

const TOTAL_HOLES = 10;
const GROUND_Y = 410;
const SKATER_X = 220;
const SKATER_WIDTH = 54;
const SKATER_HEIGHT = 88;
const RUN_SPEED = 300;
const GRAVITY = 1450;
const JUMP_VELOCITY = -680;
const FOOTPATH_Y = GROUND_Y - 74;

export class Minigame2Scene extends Phaser.Scene {
	private readonly skaterBaseScale = 86 / 395;
	private cleanupListeners: Array<() => void> = [];
	private actionPressed = false;
	private jumpQueued = false;
	private jumpConsumed = false;
	private gameStatus: "booting" | "playing" | "won" | "lost" = "booting";
	private roundElapsedMs = 0;
	private holes: Hole[] = [];
	private skaterY = GROUND_Y;
	private skaterVelocityY = 0;
	private trackOffset = 0;
	private skylineOffset = 0;
	private sidewalkOffset = 0;
	private roadGraphics?: Phaser.GameObjects.Graphics;
	private backgroundGraphics?: Phaser.GameObjects.Graphics;
	private skaterShadow?: Phaser.GameObjects.Ellipse;
	private skater?: Phaser.GameObjects.Image;

	constructor() {
		super("minigame2");
	}

	create() {
		this.cameras.main.setBackgroundColor("#0a1120");
		this.setupEventBridge();
		this.createWorld();
		this.startRound();
		gameEventBus.emit(GAME_EVENTS.SCENE_READY, { sceneKey: "Minigame 2" });
	}

	update(_time: number, delta: number) {
		if (this.gameStatus !== "playing") {
			return;
		}

		this.roundElapsedMs += delta;

		const dt = delta / 1000;
		this.trackOffset += RUN_SPEED * dt;
		this.skylineOffset += RUN_SPEED * 0.22 * dt;
		this.sidewalkOffset += RUN_SPEED * dt;

		if (this.jumpQueued && this.isGrounded()) {
			this.skaterVelocityY = JUMP_VELOCITY;
			this.jumpQueued = false;
		}

		this.skaterVelocityY += GRAVITY * dt;
		this.skaterY += this.skaterVelocityY * dt;

		if (this.skaterY >= GROUND_Y) {
			this.skaterY = GROUND_Y;
			this.skaterVelocityY = 0;
			if (!this.actionPressed) {
				this.jumpConsumed = false;
			}
		}

		this.updateHoles(dt);
		this.redrawWorld();
		this.updateSkaterPose();
		this.emitProgress();
	}

	private setupEventBridge() {
		this.cleanupListeners = [
			gameEventBus.on(GAME_EVENTS.ACTION_PRESS, ({ active }) => {
				this.actionPressed = active;

				if (active && !this.jumpConsumed && this.gameStatus === "playing") {
					this.jumpQueued = true;
					this.jumpConsumed = true;
				}
			}),
			gameEventBus.on(GAME_EVENTS.RESTART_GAME, ({ sceneKey }) => {
				if (sceneKey !== this.sys.settings.key || !this.scene.manager || !this.sys.settings.active) {
					return;
				}

				this.scene.restart();
			}),
		];

		const cleanupBridge = () => {
			this.cleanupListeners.forEach((cleanup) => cleanup());
			this.cleanupListeners = [];
		};

		this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanupBridge);
		this.events.once(Phaser.Scenes.Events.DESTROY, cleanupBridge);
	}

	private createWorld() {
		this.backgroundGraphics = this.add.graphics();
		this.roadGraphics = this.add.graphics();
		this.backgroundGraphics.setDepth(0);
		this.roadGraphics.setDepth(1);

		this.add
			.text(this.scale.width / 2, 44, "SKATER CITY", {
				fontFamily: "Arial",
				fontSize: "30px",
				color: "#fff0bf",
			})
			.setOrigin(0.5);

		this.skater = this.add.image(SKATER_X, GROUND_Y - 26, "skater-sprite").setScale(this.skaterBaseScale);
		this.skaterShadow = this.add.ellipse(SKATER_X, GROUND_Y + 18, 96, 22, 0xFFFFFF, 0.25).setDepth(2);
		this.skater.setDepth(3);
	}

	private startRound() {
		this.gameStatus = "playing";
		this.roundElapsedMs = 0;
		this.actionPressed = false;
		this.jumpQueued = false;
		this.jumpConsumed = false;
		this.skaterY = GROUND_Y;
		this.skaterVelocityY = 0;
		this.trackOffset = 0;
		this.skylineOffset = 0;
		this.sidewalkOffset = 0;

		let cursor = this.scale.width + 180;
		this.holes = Array.from({ length: TOTAL_HOLES }, (_, index) => {
			cursor += Phaser.Math.Between(250, 360);
			const width = Phaser.Math.Between(86, 124);
			const hole = {
				index,
				x: cursor,
				width,
				cleared: false,
				failed: false,
			};
			cursor += width;
			return hole;
		});

		this.emitState("Roll in and hit jump before each gap.");
		this.redrawWorld();
		this.updateSkaterPose();
	}

	private updateHoles(dt: number) {
		for (const hole of this.holes) {
			if (hole.cleared || hole.failed) {
				continue;
			}

			hole.x -= RUN_SPEED * dt;

			const holeLeft = hole.x - hole.width / 2;
			const holeRight = hole.x + hole.width / 2;
			const skaterLeft = SKATER_X - SKATER_WIDTH / 2;
			const skaterRight = SKATER_X + SKATER_WIDTH / 2;
			const skaterBottom = this.skaterY + SKATER_HEIGHT / 2;

			if (holeRight < skaterLeft) {
				hole.cleared = true;
				const clearedCount = this.holes.filter((entry) => entry.cleared).length;

				if (clearedCount >= TOTAL_HOLES) {
					this.endRound("won", "You cleared all ten holes and rolled out clean.");
					return;
				}
				continue;
			}

			const overlapsX = skaterRight > holeLeft && skaterLeft < holeRight;
			const nearGround = skaterBottom >= GROUND_Y - 2;

			if (overlapsX && nearGround) {
				hole.failed = true;
				this.endRound("lost", "You clipped a hole. Time the jump earlier and keep the run alive.");
				return;
			}
		}
	}

	private redrawWorld() {
		if (!this.backgroundGraphics || !this.roadGraphics) {
			return;
		}

		const { width, height } = this.scale;
		const buildingSpacing = 150;
		const buildingWidth = 88;
		const skylineWrappedOffset = ((this.skylineOffset % buildingSpacing) + buildingSpacing) % buildingSpacing;
		const skylineStartIndex = Math.floor(this.skylineOffset / buildingSpacing);
		const buildingBaseX = -110 - skylineWrappedOffset;
		const stripeSpacing = 90;
		const stripeWidth = 48;
		const stripeWrappedOffset = ((this.trackOffset % stripeSpacing) + stripeSpacing) % stripeSpacing;
		const stripeBaseX = -60 - stripeWrappedOffset;
		const streetlightSpacing = 210;
		const streetlightWrappedOffset = ((this.sidewalkOffset % streetlightSpacing) + streetlightSpacing) % streetlightSpacing;
		const streetlightBaseX = -120 - streetlightWrappedOffset;

		this.backgroundGraphics.clear();
		this.backgroundGraphics.fillGradientStyle(0x162033, 0x162033, 0x0a1020, 0x0a1020, 1);
		this.backgroundGraphics.fillRect(0, 0, width, height);

		for (let index = 0; index < Math.ceil((width + buildingWidth + 220) / buildingSpacing) + 2; index += 1) {
			const worldIndex = skylineStartIndex + index;
			const buildingX = buildingBaseX + index * buildingSpacing;
			const buildingHeight = 80 + (((worldIndex % 4) + 4) % 4) * 24;
			this.backgroundGraphics.fillStyle(0x1d2b45, 0.55);
			this.backgroundGraphics.fillRect(buildingX, 180 - buildingHeight, 88, buildingHeight);
			this.backgroundGraphics.fillStyle(0xfbbf24, 0.3);
			for (let row = 0; row < 4; row += 1) {
				for (let column = 0; column < 2; column += 1) {
					this.backgroundGraphics.fillRect(buildingX + 14 + column * 26, 190 - buildingHeight + row * 18, 10, 10);
				}
			}
		}

		this.backgroundGraphics.fillStyle(0x2b3445, 1);
		this.backgroundGraphics.fillRect(0, FOOTPATH_Y, width, 26);
		this.backgroundGraphics.fillStyle(0x44516a, 1);
		this.backgroundGraphics.fillRect(0, FOOTPATH_Y + 22, width, 4);

		for (let index = 0; index < Math.ceil((width + 240) / streetlightSpacing) + 2; index += 1) {
			const lightX = streetlightBaseX + index * streetlightSpacing;
			this.backgroundGraphics.fillStyle(0x3a4254, 1);
			this.backgroundGraphics.fillRect(lightX, FOOTPATH_Y - 86, 7, 86);
			this.backgroundGraphics.fillStyle(0x4b5568, 1);
			this.backgroundGraphics.fillRect(lightX - 14, FOOTPATH_Y - 86, 28, 5);
			this.backgroundGraphics.fillStyle(0xffd783, 0.95);
			this.backgroundGraphics.fillCircle(lightX, FOOTPATH_Y - 79, 8);
			this.backgroundGraphics.fillStyle(0xffd783, 0.12);
			this.backgroundGraphics.fillTriangle(
				lightX - 46,
				FOOTPATH_Y + 6,
				lightX + 46,
				FOOTPATH_Y + 6,
				lightX,
				FOOTPATH_Y - 54,
			);
		}

		this.backgroundGraphics.fillStyle(0x111827, 1);
		this.backgroundGraphics.fillRect(0, GROUND_Y - 8, width, height - (GROUND_Y - 8));
		this.backgroundGraphics.fillStyle(0xf59e0b, 1);
		for (let index = 0; index < Math.ceil((width + stripeWidth + 120) / stripeSpacing) + 2; index += 1) {
			const stripeX = stripeBaseX + index * stripeSpacing;
			this.backgroundGraphics.fillRect(stripeX, GROUND_Y + 22, 48, 6);
		}

		this.roadGraphics.clear();
		this.roadGraphics.fillStyle(0x1f2937, 1);
		this.roadGraphics.fillRect(0, GROUND_Y - 18, width, 42);
		this.roadGraphics.fillStyle(0x0a0f19, 1);

		for (const hole of this.holes) {
			if (hole.cleared) {
				continue;
			}

			this.roadGraphics.fillRect(hole.x - hole.width / 2, GROUND_Y - 18, hole.width, 42);
			this.roadGraphics.lineStyle(3, 0x38bdf8, 0.35);
			this.roadGraphics.strokeRect(hole.x - hole.width / 2, GROUND_Y - 18, hole.width, 42);
		}
	}

	private updateSkaterPose() {
		if (!this.skater || !this.skaterShadow) {
			return;
		}

		const airborne = !this.isGrounded();
		this.skater.y = this.skaterY - 18;
		this.skater.rotation = Phaser.Math.Clamp(this.skaterVelocityY / -1900, -0.28, 0.22);
		this.skater.setScale(this.skaterBaseScale, this.skaterBaseScale * (airborne ? 1.03 : 1));
		this.skaterShadow.scaleX = airborne ? 0.78 : 1;
		this.skaterShadow.scaleY = airborne ? 0.82 : 1;
		this.skaterShadow.alpha = airborne ? 0.22 : 0.32;
	}

	private emitProgress() {
		const clearedCount = this.holes.filter((hole) => hole.cleared).length;
		this.emitState(`Clear all ten gaps. Holes passed: ${clearedCount} / ${TOTAL_HOLES}.`);
	}

	private emitState(message: string) {
		gameEventBus.emit(GAME_EVENTS.GAME_STATE, {
			sceneKey: "Minigame 2",
			status: this.gameStatus,
			remainingChunks: TOTAL_HOLES - this.holes.filter((hole) => hole.cleared).length,
			totalChunks: TOTAL_HOLES,
			elapsedMs: this.roundElapsedMs,
			message,
		});
	}

	private endRound(status: "won" | "lost", message: string) {
		this.gameStatus = status;
		this.jumpQueued = false;
		this.actionPressed = false;
		if (status === "lost") {
			this.skaterVelocityY = Math.max(this.skaterVelocityY, 240);
		}
		this.emitState(message);
	}

	private isGrounded() {
		return this.skaterY >= GROUND_Y;
	}
}