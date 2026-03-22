import * as Phaser from "phaser";
import { GAME_EVENTS, gameEventBus } from "@/game/event-bus";

type TrafficVehicle = {
	id: number;
	laneIndex: number;
	x: number;
	y: number;
	width: number;
	height: number;
	color: number;
	glowColor: number;
	tint: number;
	shape: "car" | "van" | "bike";
	passedPlayer: boolean;
};

type LaneState = {
	index: number;
	centerX: number;
	baseSpeed: number;
	currentSpeed: number;
	targetSpeed: number;
	targetTimer: number;
	spawnTimer: number;
	nextSpawnGap: number;
	vehicles: TrafficVehicle[];
};

const SURVIVAL_TIME_MS = 24_000;
const HIGHWAY_LEFT = 180;
const HIGHWAY_RIGHT = 780;
const HIGHWAY_WIDTH = HIGHWAY_RIGHT - HIGHWAY_LEFT;
const HIGHWAY_TOP = 42;
const HIGHWAY_BOTTOM = 540;
const LANE_COUNT = 3;
const LANE_WIDTH = HIGHWAY_WIDTH / LANE_COUNT;
const PLAYER_Y = 430;
const PLAYER_WIDTH = 88;
const PLAYER_HEIGHT = 120;
const PLAYER_ACCELERATION = 350;
const PLAYER_MAX_SPEED = 210;
const PLAYER_FORWARD_SCROLL_SPEED = 410;
const PLAYER_EDGE_MARGIN = 42;
const MIN_LANE_SPEED = 155;
const MAX_LANE_SPEED = 255;

function laneCenterX(index: number) {
	return HIGHWAY_LEFT + LANE_WIDTH * index + LANE_WIDTH / 2;
}

function clampLaneSpeed(value: number) {
	return Phaser.Math.Clamp(value, MIN_LANE_SPEED, MAX_LANE_SPEED);
}

export class Minigame4Scene extends Phaser.Scene {
	private cleanupListeners: Array<() => void> = [];
	private backgroundGraphics?: Phaser.GameObjects.Graphics;
	private trafficGraphics?: Phaser.GameObjects.Graphics;
	private bikeShadow?: Phaser.GameObjects.Ellipse;
	private bike?: Phaser.GameObjects.Container;
	private actionPressed = false;
	private actionConsumed = false;
	private steerDirection: -1 | 1 = 1;
	private playerX = 480;
	private playerVelocityX = 0;
	private skylineOffset = 0;
	private roadOffset = 0;
	private laneStates: LaneState[] = [];
	private nextVehicleId = 0;
	private roundStartTime = 0;
	private gameStatus: "booting" | "playing" | "won" | "lost" = "booting";

	constructor() {
		super("minigame4");
	}

	create() {
		this.cameras.main.setBackgroundColor("#050711");
		this.setupEventBridge();
		this.createWorld();
		this.startRound();
		gameEventBus.emit(GAME_EVENTS.SCENE_READY, { sceneKey: "Minigame 4" });
	}

	update(_time: number, delta: number) {
		if (this.gameStatus !== "playing") {
			return;
		}

		const dt = delta / 1000;
		this.skylineOffset += PLAYER_FORWARD_SCROLL_SPEED * 0.16 * dt;
		this.roadOffset += PLAYER_FORWARD_SCROLL_SPEED * dt;

		this.updatePlayer(dt);
		this.updateLanes(dt);
		this.redrawWorld();
		this.updateBikePose();
		this.emitProgress();

		if (this.time.now - this.roundStartTime >= SURVIVAL_TIME_MS) {
			this.endRound("won", "You stayed ahead of the traffic wave for the full twenty-four seconds.");
		}
	}

	private setupEventBridge() {
		this.cleanupListeners = [
			gameEventBus.on(GAME_EVENTS.ACTION_PRESS, ({ active }) => {
				this.actionPressed = active;

				if (active && !this.actionConsumed && this.gameStatus === "playing") {
					this.steerDirection *= -1;
					this.actionConsumed = true;
				}

				if (!active) {
					this.actionConsumed = false;
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
		this.trafficGraphics = this.add.graphics();

		const bikeGlow = this.add.ellipse(0, 10, 88, 34, 0x22d3ee, 0.22);
		const rearWheel = this.add.circle(-18, 26, 12, 0x070b16, 1);
		const frontWheel = this.add.circle(18, 22, 11, 0x070b16, 1);
		const rearGlow = this.add.circle(-18, 26, 8, 0xf472b6, 0.75);
		const frontGlow = this.add.circle(18, 22, 7, 0x22d3ee, 0.82);
		const frame = this.add.rectangle(0, 0, 18, 64, 0x7dd3fc, 1);
		const chassis = this.add.polygon(0, -6, [-24, 14, -6, -26, 12, -18, 26, 10, 4, 24], 0xf472b6, 1);
		const canopy = this.add.polygon(2, -20, [-16, 14, 0, -16, 14, 8], 0xe0f2fe, 0.95);
		const tail = this.add.rectangle(0, 34, 42, 10, 0xfb7185, 1);

		this.bike = this.add.container(this.playerX, PLAYER_Y, [bikeGlow, rearWheel, frontWheel, rearGlow, frontGlow, frame, chassis, canopy, tail]);
		this.bikeShadow = this.add.ellipse(this.playerX, PLAYER_Y + 44, 108, 30, 0x020617, 0.42);
	}

	private startRound() {
		this.gameStatus = "playing";
		this.roundStartTime = this.time.now;
		this.actionPressed = false;
		this.actionConsumed = false;
		this.steerDirection = Phaser.Math.Between(0, 1) === 0 ? -1 : 1;
		this.playerX = 480;
		this.playerVelocityX = 0;
		this.skylineOffset = 0;
		this.roadOffset = 0;
		this.nextVehicleId = 0;

		this.laneStates = Array.from({ length: LANE_COUNT }, (_, index) => {
			const baseSpeed = Phaser.Math.Between(170, 240);
			return {
				index,
				centerX: laneCenterX(index),
				baseSpeed,
				currentSpeed: baseSpeed,
				targetSpeed: baseSpeed,
				targetTimer: Phaser.Math.FloatBetween(0.7, 1.4),
				spawnTimer: Phaser.Math.FloatBetween(0.8, 1.5),
				nextSpawnGap: Phaser.Math.Between(220, 320),
				vehicles: [],
			};
		});

		for (const lane of this.laneStates) {
			let seedY = Phaser.Math.Between(-760, -320);
			const seedCount = Phaser.Math.Between(1, 2);
			for (let index = 0; index < seedCount; index += 1) {
				const vehicle = this.createVehicle(lane, seedY);
				lane.vehicles.push(vehicle);
				seedY -= vehicle.height + Phaser.Math.Between(170, 250);
			}
		}

		this.emitState("Tap the action button to flip your drift and overtake the traffic flow.");
		this.redrawWorld();
		this.updateBikePose();
	}

	private updatePlayer(dt: number) {
		this.playerVelocityX += this.steerDirection * PLAYER_ACCELERATION * dt;
		this.playerVelocityX = Phaser.Math.Clamp(this.playerVelocityX, -PLAYER_MAX_SPEED, PLAYER_MAX_SPEED);
		this.playerX += this.playerVelocityX * dt;

		const leftLimit = HIGHWAY_LEFT + PLAYER_EDGE_MARGIN;
		const rightLimit = HIGHWAY_RIGHT - PLAYER_EDGE_MARGIN;

		if (this.playerX <= leftLimit) {
			this.playerX = leftLimit;
			this.playerVelocityX = Math.max(0, this.playerVelocityX) * 0.2;
		}

		if (this.playerX >= rightLimit) {
			this.playerX = rightLimit;
			this.playerVelocityX = Math.min(0, this.playerVelocityX) * 0.2;
		}
	}

	private updateLanes(dt: number) {
		for (const lane of this.laneStates) {
			lane.targetTimer -= dt;
			if (lane.targetTimer <= 0) {
				lane.targetSpeed = clampLaneSpeed(lane.baseSpeed + Phaser.Math.Between(-34, 34));
				lane.targetTimer = Phaser.Math.FloatBetween(0.7, 1.8);
			}

			lane.currentSpeed = Phaser.Math.Linear(lane.currentSpeed, lane.targetSpeed, dt * 1.3);
			lane.spawnTimer -= dt;

			if (lane.spawnTimer <= 0 && this.canSpawnVehicle(lane)) {
				lane.vehicles.push(this.createVehicle(lane, this.getSpawnY(lane)));
				lane.spawnTimer = Phaser.Math.FloatBetween(1.2, 1.9);
				lane.nextSpawnGap = Phaser.Math.Between(220, 340);
			}

			for (const vehicle of lane.vehicles) {
				vehicle.y += lane.currentSpeed * dt;

				if (!vehicle.passedPlayer && vehicle.y > PLAYER_Y + 20) {
					vehicle.passedPlayer = true;
				}

				if (this.overlapsPlayer(vehicle)) {
					this.endRound("lost", "You clipped the traffic stream. Flip direction earlier and thread the gap.");
					return;
				}
			}

			lane.vehicles = lane.vehicles.filter((vehicle) => vehicle.y < HIGHWAY_BOTTOM + 160);
		}
	}

	private canSpawnVehicle(lane: LaneState) {
		const frontVehicle = lane.vehicles.reduce<TrafficVehicle | undefined>((closest, vehicle) => {
			if (!closest || vehicle.y > closest.y) {
				return vehicle;
			}

			return closest;
		}, undefined);

		if (!frontVehicle) {
			return true;
		}

		const frontVehicleTop = frontVehicle.y - frontVehicle.height / 2;
		return frontVehicleTop > lane.nextSpawnGap;
	}

	private getSpawnY(lane: LaneState) {
		const frontVehicle = lane.vehicles.reduce<TrafficVehicle | undefined>((closest, vehicle) => {
			if (!closest || vehicle.y < closest.y) {
				return vehicle;
			}

			return closest;
		}, undefined);

		if (!frontVehicle) {
			return Phaser.Math.Between(-280, -160);
		}

		return frontVehicle.y - frontVehicle.height / 2 - lane.nextSpawnGap;
	}

	private createVehicle(lane: LaneState, y: number): TrafficVehicle {
		const shape = Phaser.Utils.Array.GetRandom(["car", "car", "van", "bike"] as const);
		const specs = {
			car: { width: 76, height: 118, color: 0x94a3b8, glow: 0x22d3ee, tint: 0xe0f2fe },
			van: { width: 88, height: 150, color: 0x64748b, glow: 0xf59e0b, tint: 0xfef3c7 },
			bike: { width: 58, height: 100, color: 0x312e81, glow: 0xf472b6, tint: 0xfce7f3 },
		} as const;
		const spec = specs[shape];

		return {
			id: this.nextVehicleId++,
			laneIndex: lane.index,
			x: lane.centerX + Phaser.Math.Between(-16, 16),
			y,
			width: spec.width,
			height: spec.height,
			color: spec.color,
			glowColor: spec.glow,
			tint: spec.tint,
			shape,
			passedPlayer: false,
		};
	}

	private overlapsPlayer(vehicle: TrafficVehicle) {
		const horizontalGap = Math.abs(vehicle.x - this.playerX);
		const verticalGap = Math.abs(vehicle.y - PLAYER_Y);
		return horizontalGap < vehicle.width * 0.44 + PLAYER_WIDTH * 0.28 && verticalGap < vehicle.height * 0.42 + PLAYER_HEIGHT * 0.3;
	}

	private redrawWorld() {
		if (!this.backgroundGraphics || !this.trafficGraphics) {
			return;
		}

		const { width, height } = this.scale;
		const buildingSpacing = 164;
		const roadStripeSpacing = 88;
		const roadStripeOffset = ((this.roadOffset % roadStripeSpacing) + roadStripeSpacing) % roadStripeSpacing;

		this.backgroundGraphics.clear();
		this.backgroundGraphics.fillGradientStyle(0x07111f, 0x07111f, 0x02040c, 0x02040c, 1);
		this.backgroundGraphics.fillRect(0, 0, width, height);
		const firstWorldRow = Math.floor((-this.skylineOffset - buildingSpacing) / buildingSpacing);
		const lastWorldRow = Math.ceil((height - this.skylineOffset + buildingSpacing) / buildingSpacing);
		for (let worldRow = firstWorldRow; worldRow <= lastWorldRow; worldRow += 1) {
			const worldIndex = worldRow;
			const buildingY = worldRow * buildingSpacing + this.skylineOffset;
			const primaryHeight = 112 + (((worldIndex % 5) + 5) % 5) * 22;
			const secondaryHeight = 84 + ((((worldIndex + 2) % 4) + 4) % 4) * 24;
			const leftX = 22 + ((worldIndex % 2) === 0 ? 0 : 10);
			const leftInnerX = 92 + ((worldIndex % 3) === 0 ? 6 : -4);
			const rightX = width - 104 - ((worldIndex % 2) === 0 ? 6 : -8);
			const rightInnerX = width - 172 + ((worldIndex % 3) === 1 ? 10 : -2);

			this.backgroundGraphics.fillStyle(0x081220, 0.82);
			this.backgroundGraphics.fillRect(leftX, buildingY, 72, primaryHeight);
			this.backgroundGraphics.fillRect(leftInnerX, buildingY + 20, 58, secondaryHeight);
			this.backgroundGraphics.fillRect(rightX, buildingY + 6, 74, primaryHeight + 12);
			this.backgroundGraphics.fillRect(rightInnerX, buildingY + 26, 54, secondaryHeight - 10);

			this.backgroundGraphics.fillStyle(worldIndex % 2 === 0 ? 0x22d3ee : 0xf472b6, 0.22);
			for (let row = 0; row < 4; row += 1) {
				this.backgroundGraphics.fillRect(leftX + 12, buildingY + 16 + row * 20, 8, 10);
				this.backgroundGraphics.fillRect(leftX + 34, buildingY + 16 + row * 20, 8, 10);
				this.backgroundGraphics.fillRect(leftInnerX + 14, buildingY + 34 + row * 18, 8, 10);
				this.backgroundGraphics.fillRect(rightX + 14, buildingY + 20 + row * 20, 8, 10);
				this.backgroundGraphics.fillRect(rightX + 38, buildingY + 20 + row * 20, 8, 10);
				this.backgroundGraphics.fillRect(rightInnerX + 12, buildingY + 40 + row * 18, 8, 10);
			}
		}

		this.backgroundGraphics.fillStyle(0x0a1220, 0.95);
		this.backgroundGraphics.fillRect(HIGHWAY_LEFT - 40, HIGHWAY_TOP, HIGHWAY_WIDTH + 80, HIGHWAY_BOTTOM - HIGHWAY_TOP + 20);
		this.backgroundGraphics.lineStyle(3, 0x22d3ee, 0.25);
		this.backgroundGraphics.strokeRect(HIGHWAY_LEFT - 20, HIGHWAY_TOP + 12, HIGHWAY_WIDTH + 40, HIGHWAY_BOTTOM - HIGHWAY_TOP - 10);
		this.backgroundGraphics.fillStyle(0x111827, 1);
		this.backgroundGraphics.fillRect(HIGHWAY_LEFT, HIGHWAY_TOP, HIGHWAY_WIDTH, HIGHWAY_BOTTOM - HIGHWAY_TOP);

		for (let laneIndex = 0; laneIndex <= LANE_COUNT; laneIndex += 1) {
			const x = HIGHWAY_LEFT + LANE_WIDTH * laneIndex;
			this.backgroundGraphics.lineStyle(laneIndex === 0 || laneIndex === LANE_COUNT ? 5 : 2, 0x38bdf8, laneIndex === 0 || laneIndex === LANE_COUNT ? 0.32 : 0.18);
			this.backgroundGraphics.beginPath();
			this.backgroundGraphics.moveTo(x, HIGHWAY_TOP);
			this.backgroundGraphics.lineTo(x, HIGHWAY_BOTTOM);
			this.backgroundGraphics.strokePath();
		}

		for (let laneIndex = 0; laneIndex < LANE_COUNT; laneIndex += 1) {
			const laneLeft = HIGHWAY_LEFT + laneIndex * LANE_WIDTH;
			const stripeBaseY = HIGHWAY_TOP + roadStripeOffset - roadStripeSpacing;
			this.backgroundGraphics.fillStyle(laneIndex % 2 === 0 ? 0x0b1222 : 0x0d1629, 0.82);
			this.backgroundGraphics.fillRect(laneLeft, HIGHWAY_TOP, LANE_WIDTH, HIGHWAY_BOTTOM - HIGHWAY_TOP);
			for (let index = 0; index < 10; index += 1) {
				const y = stripeBaseY + index * roadStripeSpacing;
				this.backgroundGraphics.fillStyle(0xf8fafc, 0.16);
				this.backgroundGraphics.fillRoundedRect(laneLeft + LANE_WIDTH * 0.42, y, LANE_WIDTH * 0.16, 36, 10);
			}
		}

		this.trafficGraphics.clear();
		for (const lane of this.laneStates) {
			for (const vehicle of lane.vehicles) {
				this.drawVehicle(vehicle);
			}
		}
	}

	private drawVehicle(vehicle: TrafficVehicle) {
		if (!this.trafficGraphics) {
			return;
		}

		const graphics = this.trafficGraphics;
		const left = vehicle.x - vehicle.width / 2;
		const top = vehicle.y - vehicle.height / 2;

		graphics.fillStyle(vehicle.glowColor, 0.14);
		graphics.fillRoundedRect(left - 6, top - 8, vehicle.width + 12, vehicle.height + 16, 20);
		graphics.fillStyle(vehicle.color, 1);
		graphics.fillRoundedRect(left, top, vehicle.width, vehicle.height, vehicle.shape === "bike" ? 18 : 24);
		graphics.lineStyle(3, vehicle.glowColor, 0.9);
		graphics.strokeRoundedRect(left, top, vehicle.width, vehicle.height, vehicle.shape === "bike" ? 18 : 24);
		graphics.fillStyle(vehicle.tint, 0.92);
		graphics.fillRoundedRect(left + vehicle.width * 0.18, top + 14, vehicle.width * 0.64, vehicle.shape === "van" ? 26 : 20, 8);
		graphics.fillStyle(vehicle.glowColor, 0.72);
		graphics.fillRect(vehicle.x - vehicle.width * 0.18, top + vehicle.height - 14, vehicle.width * 0.36, 5);
		graphics.fillRect(vehicle.x - vehicle.width * 0.18, top + 9, vehicle.width * 0.36, 5);

		if (vehicle.shape === "bike") {
			graphics.fillStyle(0x020617, 1);
			graphics.fillCircle(vehicle.x - 13, top + vehicle.height - 6, 9);
			graphics.fillCircle(vehicle.x + 13, top + vehicle.height - 10, 8);
		}
	}

	private updateBikePose() {
		if (!this.bike || !this.bikeShadow) {
			return;
		}

		this.bike.x = this.playerX;
		this.bike.y = PLAYER_Y;
		this.bike.rotation = Phaser.Math.Clamp(this.playerVelocityX / PLAYER_MAX_SPEED, -1, 1) * 0.34;
		this.bikeShadow.x = this.playerX;
		this.bikeShadow.scaleX = 1 - Math.abs(this.playerVelocityX / PLAYER_MAX_SPEED) * 0.18;
		this.bikeShadow.alpha = 0.28 + Math.abs(this.playerVelocityX / PLAYER_MAX_SPEED) * 0.08;
	}

	private emitProgress() {
		const elapsedMs = Math.max(0, this.time.now - this.roundStartTime);
		const remainingMs = Math.max(0, SURVIVAL_TIME_MS - elapsedMs);
		const directionLabel = this.steerDirection < 0 ? "left" : "right";
		this.emitState(`Traffic is closing in. Survive ${Math.ceil(remainingMs / 1000)}s more and keep drifting ${directionLabel}.`);
	}

	private emitState(message: string) {
		const elapsedMs = Math.max(0, this.time.now - this.roundStartTime);
		gameEventBus.emit(GAME_EVENTS.GAME_STATE, {
			sceneKey: "Minigame 4",
			status: this.gameStatus,
			remainingChunks: Math.max(0, Math.ceil((SURVIVAL_TIME_MS - elapsedMs) / 1000)),
			totalChunks: Math.ceil(SURVIVAL_TIME_MS / 1000),
			elapsedMs,
			message,
		});
	}

	private endRound(status: "won" | "lost", message: string) {
		if (this.gameStatus !== "playing") {
			return;
		}

		this.gameStatus = status;
		this.actionPressed = false;
		this.actionConsumed = false;
		this.emitState(message);
	}
}