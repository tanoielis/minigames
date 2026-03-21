import * as Phaser from "phaser";
import { GAME_EVENTS, gameEventBus } from "@/game/event-bus";

type IceCell = {
	x: number;
	y: number;
	size: number;
};

type IceChunk = {
	id: number;
	active: boolean;
	state: "stable" | "warning" | "sunk";
	cells: IceCell[];
	graphics: Phaser.GameObjects.Graphics;
	warningStartedAt: number;
	removeAt: number;
};

const TOTAL_CHUNKS = 10;
const WIN_CHUNKS_LEFT = 3;
const ICE_COLOR = 0xdffcff;
const WARNING_COLOR = 0x2f9fff;
const WATER_COLOR = 0x07172b;
const CELL_SIZE = 28;

function mixColor(start: number, end: number, amount: number) {
	const clamped = Phaser.Math.Clamp(amount, 0, 1);
	const startR = (start >> 16) & 0xff;
	const startG = (start >> 8) & 0xff;
	const startB = start & 0xff;
	const endR = (end >> 16) & 0xff;
	const endG = (end >> 8) & 0xff;
	const endB = end & 0xff;

	return (
		(Math.round(Phaser.Math.Linear(startR, endR, clamped)) << 16) |
		(Math.round(Phaser.Math.Linear(startG, endG, clamped)) << 8) |
		Math.round(Phaser.Math.Linear(startB, endB, clamped))
	);
}

export class Minigame1Scene extends Phaser.Scene {
	private chunks: IceChunk[] = [];
	private inputVector = new Phaser.Math.Vector2();
	private playerVelocity = new Phaser.Math.Vector2();
	private playerPosition = new Phaser.Math.Vector2();
	private penguin?: Phaser.GameObjects.Container;
	private penguinShadow?: Phaser.GameObjects.Ellipse;
	private waterRipples?: Phaser.GameObjects.Graphics;
	private nextSinkAt = 0;
	private warningChunkId: number | null = null;
	private roundStartTime = 0;
	private hudLastEmittedAt = 0;
	private gameStatus: "booting" | "playing" | "won" | "lost" = "booting";
	private cleanupListeners: Array<() => void> = [];

	constructor() {
		super("minigame1");
	}

	create() {
		this.cameras.main.setBackgroundColor("#050b16");
		this.setupEventBridge();
		this.buildBackdrop();
		this.startRound();

		gameEventBus.emit(GAME_EVENTS.SCENE_READY, { sceneKey: "Minigame 1" });
	}

	update(time: number, delta: number) {
		if (this.waterRipples) {
			this.redrawWater(time);
		}

		if (this.gameStatus !== "playing") {
			return;
		}

		this.updateWarningChunk(time);
		this.updatePlayer(delta);

		if (!this.isPlayerSupported()) {
			this.endRound("lost", "The floe cracked away beneath your penguin. Tap restart and try a new ice split.");
			return;
		}

		if (this.warningChunkId === null && this.getActiveChunkCount() > WIN_CHUNKS_LEFT && time >= this.nextSinkAt) {
			this.startChunkWarning(time);
		}

		if (time - this.hudLastEmittedAt > 120) {
			this.emitGameState("Keep sliding and stay off the chunk that starts turning blue.");
			this.hudLastEmittedAt = time;
		}
	}

	private setupEventBridge() {
		this.cleanupListeners.forEach((cleanup) => cleanup());
		this.cleanupListeners = [
			gameEventBus.on(GAME_EVENTS.INPUT_MOVE, ({ x, y }) => {
				this.inputVector.set(x, y);
			}),
			gameEventBus.on(GAME_EVENTS.RESTART_GAME, () => {
				this.scene.restart();
			}),
		];

		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			this.cleanupListeners.forEach((cleanup) => cleanup());
			this.cleanupListeners = [];
		});
	}

	private buildBackdrop() {
		const { width, height } = this.scale;

		this.add.ellipse(width / 2, height / 2, width * 1.25, height * 1.15, WATER_COLOR, 1);
		this.waterRipples = this.add.graphics();
		this.add
			.text(width / 2, 42, "PENGUIN PANIC", {
				fontFamily: "Arial",
				fontSize: "30px",
				color: "#d9fbff",
			})
			.setOrigin(0.5);
	}

	private startRound() {
		this.chunks.forEach((chunk) => chunk.graphics.destroy());
		this.chunks = [];
		this.warningChunkId = null;
		this.gameStatus = "playing";
		this.roundStartTime = this.time.now;
		this.hudLastEmittedAt = 0;
		this.playerVelocity.set(0, 0);
		this.inputVector.set(0, 0);

		this.generateIceChunks();
		this.spawnPenguin();
		this.nextSinkAt = this.time.now + 2400;

		this.emitGameState("The ice is intact for now. Stay centered and watch for blue warning flashes.");
	}

	private generateIceChunks() {
		const { width, height } = this.scale;
		const centerX = width / 2;
		const centerY = height / 2 + 24;
		const radiusX = 255;
		const radiusY = 168;

		const anchors = [
			{ x: centerX + Phaser.Math.Between(-24, 24), y: centerY + Phaser.Math.Between(-18, 18) },
			...Array.from({ length: 3 }, (_, index) => {
				const angle = -Math.PI / 2 + (index * Math.PI * 2) / 3 + Phaser.Math.FloatBetween(-0.18, 0.18);
				return {
					x: centerX + Math.cos(angle) * Phaser.Math.Between(96, 122),
					y: centerY + Math.sin(angle) * Phaser.Math.Between(72, 94),
				};
			}),
			...Array.from({ length: 6 }, (_, index) => {
				const angle = -Math.PI + index * (Math.PI / 3) + Phaser.Math.FloatBetween(-0.15, 0.15);
				return {
					x: centerX + Math.cos(angle) * Phaser.Math.Between(170, 220),
					y: centerY + Math.sin(angle) * Phaser.Math.Between(122, 158),
				};
			}),
		];

		const chunkCells = Array.from({ length: TOTAL_CHUNKS }, () => [] as IceCell[]);

		for (let x = centerX - radiusX; x <= centerX + radiusX; x += CELL_SIZE) {
			for (let y = centerY - radiusY; y <= centerY + radiusY; y += CELL_SIZE) {
				const normalizedX = (x - centerX) / radiusX;
				const normalizedY = (y - centerY) / radiusY;
				const edgeNoise = Math.sin(x * 0.047) * Math.cos(y * 0.039) * 0.065;
				const ellipseValue = normalizedX * normalizedX + normalizedY * normalizedY;

				if (ellipseValue > 0.985 + edgeNoise) {
					continue;
				}

				let bestAnchorIndex = 0;
				let bestDistance = Number.POSITIVE_INFINITY;

				anchors.forEach((anchor, index) => {
					const dx = (x - anchor.x) / radiusX;
					const dy = (y - anchor.y) / radiusY;
					const distance = dx * dx + dy * dy;

					if (distance < bestDistance) {
						bestDistance = distance;
						bestAnchorIndex = index;
					}
				});

				chunkCells[bestAnchorIndex].push({ x, y, size: CELL_SIZE + 2 });
			}
		}

		this.chunks = chunkCells.map((cells, index) => ({
			id: index,
			active: true,
			state: "stable",
			cells,
			graphics: this.add.graphics(),
			warningStartedAt: 0,
			removeAt: 0,
		}));

		this.chunks.forEach((chunk) => this.drawChunk(chunk, ICE_COLOR));
	}

	private spawnPenguin() {
		if (this.penguin) {
			this.penguin.destroy();
		}

		if (this.penguinShadow) {
			this.penguinShadow.destroy();
		}

		const body = this.add.ellipse(0, 12, 48, 64, 0x142333, 1);
		const belly = this.add.ellipse(0, 16, 28, 40, 0xf7fdff, 1);
		const head = this.add.circle(0, -20, 18, 0x142333, 1);
		const leftEye = this.add.circle(-7, -24, 2.8, 0xffffff, 1);
		const rightEye = this.add.circle(7, -24, 2.8, 0xffffff, 1);
		const beak = this.add.triangle(0, -14, -4, 0, 4, 0, 0, 10, 0xffb347, 1);
		const leftFoot = this.add.ellipse(-11, 42, 14, 8, 0xffb347, 1);
		const rightFoot = this.add.ellipse(11, 42, 14, 8, 0xffb347, 1);

		this.penguin = this.add.container(this.scale.width / 2, this.scale.height / 2 - 8, [
			body,
			belly,
			head,
			leftEye,
			rightEye,
			beak,
			leftFoot,
			rightFoot,
		]);
		this.penguin.setDepth(20);

		this.penguinShadow = this.add.ellipse(this.scale.width / 2, this.scale.height / 2 + 28, 44, 16, 0x000000, 0.28);
		this.penguinShadow.setDepth(19);

		this.playerPosition.set(this.scale.width / 2, this.scale.height / 2 - 8);
	}

	private updatePlayer(delta: number) {
		if (!this.penguin || !this.penguinShadow) {
			return;
		}

		const dt = delta / 1000;
		const acceleration = 720;
		const damping = Math.pow(0.985, delta / 16.6667);
		const maxSpeed = 245;

		this.playerVelocity.x += this.inputVector.x * acceleration * dt;
		this.playerVelocity.y += this.inputVector.y * acceleration * dt;
		this.playerVelocity.scale(damping);

		if (this.playerVelocity.length() > maxSpeed) {
			this.playerVelocity.setLength(maxSpeed);
		}

		this.playerPosition.x += this.playerVelocity.x * dt;
		this.playerPosition.y += this.playerVelocity.y * dt;

		this.penguin.x = this.playerPosition.x;
		this.penguin.y = this.playerPosition.y;
		this.penguin.rotation = Phaser.Math.Clamp(this.playerVelocity.x / 600, -0.28, 0.28);

		this.penguinShadow.x = this.playerPosition.x;
		this.penguinShadow.y = this.playerPosition.y + 36;
	}

	private startChunkWarning(time: number) {
		const activeStableChunks = this.chunks.filter((chunk) => chunk.active && chunk.state === "stable");

		if (activeStableChunks.length === 0) {
			return;
		}

		const candidate = Phaser.Utils.Array.GetRandom(activeStableChunks);
		candidate.state = "warning";
		candidate.warningStartedAt = time;
		candidate.removeAt = time + Math.max(900, 1400 - (TOTAL_CHUNKS - this.getActiveChunkCount()) * 60);
		this.warningChunkId = candidate.id;

		this.emitGameState("A hidden chunk is turning blue. Slide clear before it sinks.");
	}

	private updateWarningChunk(time: number) {
		if (this.warningChunkId === null) {
			return;
		}

		const warningChunk = this.chunks[this.warningChunkId];

		if (!warningChunk || warningChunk.state !== "warning") {
			this.warningChunkId = null;
			return;
		}

		const progress = Phaser.Math.Clamp(
			(time - warningChunk.warningStartedAt) / (warningChunk.removeAt - warningChunk.warningStartedAt),
			0,
			1,
		);
		const pulse = 0.7 + Math.sin(time * 0.03) * 0.3;
		this.drawChunk(warningChunk, mixColor(ICE_COLOR, WARNING_COLOR, progress * 0.8 + pulse * 0.2));

		if (time >= warningChunk.removeAt) {
			warningChunk.active = false;
			warningChunk.state = "sunk";
			warningChunk.graphics.clear();
			this.warningChunkId = null;

			const activeChunks = this.getActiveChunkCount();

			if (activeChunks <= WIN_CHUNKS_LEFT) {
				this.endRound("won", "Only three chunks remain. The penguin held on and won the round.");
				return;
			}

			const removedCount = TOTAL_CHUNKS - activeChunks;
			this.nextSinkAt = time + Math.max(1250, 3500 * Math.pow(0.9, removedCount));
			this.emitGameState("Another slab just sank. The next break will come slightly faster.");
		}
	}

	private isPlayerSupported() {
		const footX = this.playerPosition.x;
		const footY = this.playerPosition.y + 28;

		return this.chunks.some((chunk) => {
			if (!chunk.active) {
				return false;
			}

			return chunk.cells.some((cell) => {
				const half = cell.size / 2;
				return footX >= cell.x - half && footX <= cell.x + half && footY >= cell.y - half && footY <= cell.y + half;
			});
		});
	}

	private getActiveChunkCount() {
		return this.chunks.filter((chunk) => chunk.active).length;
	}

	private emitGameState(message: string) {
		gameEventBus.emit(GAME_EVENTS.GAME_STATE, {
			sceneKey: "Minigame 1",
			status: this.gameStatus,
			remainingChunks: this.getActiveChunkCount(),
			totalChunks: TOTAL_CHUNKS,
			elapsedMs: Math.max(0, this.time.now - this.roundStartTime),
			message,
		});
	}

	private endRound(status: "won" | "lost", message: string) {
		this.gameStatus = status;
		this.inputVector.set(0, 0);
		this.playerVelocity.set(0, 0);

		if (status === "lost" && this.penguin) {
			this.tweens.add({
				targets: this.penguin,
				alpha: 0.35,
				y: this.penguin.y + 24,
				duration: 450,
				ease: "Quad.easeIn",
			});
		}

		this.emitGameState(message);
	}

	private drawChunk(chunk: IceChunk, color: number) {
		chunk.graphics.clear();
		chunk.graphics.fillStyle(color, 1);

		chunk.cells.forEach((cell) => {
			chunk.graphics.fillRoundedRect(cell.x - cell.size / 2, cell.y - cell.size / 2, cell.size, cell.size, 10);
		});

		chunk.graphics.setDepth(10);
	}

	private redrawWater(time: number) {
		if (!this.waterRipples) {
			return;
		}

		const { width, height } = this.scale;
		this.waterRipples.clear();

		for (let index = 0; index < 6; index += 1) {
			const phase = time * 0.0012 + index * 0.75;
			const rippleWidth = 460 + Math.sin(phase) * 60 + index * 46;
			const rippleHeight = 160 + Math.cos(phase * 1.2) * 28 + index * 16;
			this.waterRipples.lineStyle(2, 0x1eb8ff, 0.08 + index * 0.01);
			this.waterRipples.strokeEllipse(width / 2, height / 2 + 24, rippleWidth, rippleHeight);
		}
	}
}