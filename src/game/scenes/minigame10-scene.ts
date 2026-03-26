import * as Phaser from "phaser";
import { GAME_EVENTS, gameEventBus } from "@/game/event-bus";

type OpponentProfile = {
	name: string;
	texture: string;
	accent: number;
	targetMinMs: number;
	targetMaxMs: number;
	accelFraction: number;
	badStartPenaltyMs?: number;
	badStartFraction?: number;
	badStartAccelRatio?: number;
};

type OpponentMotion = {
	badStartSeconds: number;
	badStartAcceleration: number;
	mainAccelSeconds: number;
	mainAcceleration: number;
	maxSpeed: number;
};

type GearConfig = {
	sweetMin: number;
	sweetMax: number;
	maxSpeed: number;
	acceleration: number;
	coast: number;
	launchFloor: number;
};

const RACE_DISTANCE_M = 1_000;
const PX_PER_METER = 4.8;
const TRACK_START_X = 180;
const TRACK_LENGTH_PX = RACE_DISTANCE_M * PX_PER_METER;
const FINISH_WORLD_X = TRACK_START_X + TRACK_LENGTH_PX;
const WORLD_WIDTH = FINISH_WORLD_X + 420;
const WORLD_HEIGHT = 540;
const PLAYER_LANE_Y = 350;
const OPPONENT_LANE_Y = 252;
const ROUND_MAX_MS = 45_000;
const LAUNCH_LIGHT_INTERVAL_MS = 900;
const CAMERA_LERP_X = 0.085;
const CAMERA_LEAD_OFFSET = 220;

const GEARS: GearConfig[] = [
	{ sweetMin: 12, sweetMax: 15, maxSpeed: 17, acceleration: 21, coast: 8, launchFloor: 4 },
	{ sweetMin: 21, sweetMax: 25, maxSpeed: 29, acceleration: 16, coast: 7, launchFloor: 11 },
	{ sweetMin: 31, sweetMax: 36, maxSpeed: 40, acceleration: 12, coast: 5.5, launchFloor: 20 },
	{ sweetMin: 43, sweetMax: 49, maxSpeed: 54, acceleration: 8.8, coast: 4.4, launchFloor: 30 },
	{ sweetMin: 56, sweetMax: 63, maxSpeed: 69, acceleration: 6.1, coast: 3.6, launchFloor: 43 },
];

const OPPONENTS: OpponentProfile[] = [
	{
		name: "Red Car",
		texture: "minigame10-red-car",
		accent: 0xff6978,
		targetMinMs: 15_000,
		targetMaxMs: 18_000,
		accelFraction: 0.2,
		badStartPenaltyMs: 1_350,
		badStartFraction: 0.12,
		badStartAccelRatio: 0.28,
	},
	{ name: "Blue Car", texture: "minigame10-blue-car", accent: 0x68c7ff, targetMinMs: 16_000, targetMaxMs: 20_000, accelFraction: 0.27 },
	{ name: "Green Car", texture: "minigame10-green-car", accent: 0x7fe59a, targetMinMs: 18_000, targetMaxMs: 22_000, accelFraction: 0.31 },
];

function clamp01(value: number) {
	return Phaser.Math.Clamp(value, 0, 1);
}

function metersToWorldX(distanceMeters: number) {
	return TRACK_START_X + distanceMeters * PX_PER_METER;
}

function kmh(speedMetersPerSecond: number) {
	return speedMetersPerSecond * 3.6;
}

function randomBetween(min: number, max: number) {
	return Phaser.Math.Between(min, max);
}

function buildOpponentMotion(distanceMeters: number, targetTimeMs: number, accelFraction: number) {
	const totalTimeSeconds = targetTimeMs / 1000;
	const accelTimeSeconds = totalTimeSeconds * accelFraction;
	const maxSpeed = distanceMeters / (totalTimeSeconds - accelTimeSeconds * 0.5);
	const acceleration = maxSpeed / accelTimeSeconds;

	return {
		accelTimeSeconds,
		acceleration,
		maxSpeed,
	};
}

function buildOpponentMotionWithBadStart(
	distanceMeters: number,
	targetTimeMs: number,
	badStartFraction: number,
	mainAccelFraction: number,
	badStartAccelRatio: number,
): OpponentMotion {
	const totalTimeSeconds = targetTimeMs / 1000;
	const badStartSeconds = totalTimeSeconds * badStartFraction;
	const mainAccelSeconds = totalTimeSeconds * mainAccelFraction;
	const cruiseSeconds = Math.max(0.1, totalTimeSeconds - badStartSeconds - mainAccelSeconds);
	const ratio = Phaser.Math.Clamp(badStartAccelRatio, 0.05, 0.95);
	const distanceFactor =
		ratio * 0.5 * badStartSeconds * badStartSeconds +
		ratio * badStartSeconds * mainAccelSeconds +
		0.5 * mainAccelSeconds * mainAccelSeconds +
		(ratio * badStartSeconds + mainAccelSeconds) * cruiseSeconds;
	const mainAcceleration = distanceMeters / distanceFactor;
	const badStartAcceleration = mainAcceleration * ratio;
	const maxSpeed = badStartAcceleration * badStartSeconds + mainAcceleration * mainAccelSeconds;

	return {
		badStartSeconds,
		badStartAcceleration,
		mainAccelSeconds,
		mainAcceleration,
		maxSpeed,
	};
}

export class Minigame10Scene extends Phaser.Scene {
	private cleanupListeners: Array<() => void> = [];
	private backgroundGraphics?: Phaser.GameObjects.Graphics;
	private roadGraphics?: Phaser.GameObjects.Graphics;
	private playerCar?: Phaser.GameObjects.Image;
	private opponentCar?: Phaser.GameObjects.Image;
	private finishLine?: Phaser.GameObjects.Rectangle;
	private finishLine2?: Phaser.GameObjects.Rectangle;
	private opponentLabel?: Phaser.GameObjects.Text;
	private statusText?: Phaser.GameObjects.Text;
	private speedText?: Phaser.GameObjects.Text;
	private gearText?: Phaser.GameObjects.Text;
	private rpmLabel?: Phaser.GameObjects.Text;
	private rpmTrack?: Phaser.GameObjects.Rectangle;
	private rpmFill?: Phaser.GameObjects.Rectangle;
	private shiftHint?: Phaser.GameObjects.Text;
	private launchLights: Phaser.GameObjects.Arc[] = [];
	private elapsedMs = 0;
	private preRaceMs = 0;
	private raceStarted = false;
	private gameStatus: "booting" | "playing" | "won" | "lost" = "booting";
	private message = "Booting street sprint...";
	private throttleActive = false;
	private playerSpeedMs = 0;
	private playerDistanceMeters = 0;
	private playerGear = 1;
	private shiftFlashMs = 0;
	private lastShiftQuality = 0;
	private opponentProfile: OpponentProfile = OPPONENTS[0];
	private opponentTargetTimeMs = 30_000;
	private opponentMotion: OpponentMotion = {
		badStartSeconds: 0,
		badStartAcceleration: 0,
		mainAccelSeconds: 0,
		mainAcceleration: 0,
		maxSpeed: 0,
	};
	private opponentDistanceMeters = 0;
	private opponentSpeedMs = 0;

	constructor() {
		super("minigame10");
	}

	create() {
		this.cameras.main.setBackgroundColor("#0b1320");
		this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
		this.pickOpponent();
		this.setupEventBridge();
		this.buildTrack();
		this.startRace();
		this.emitControls();
		this.emitState("Watch the lights. Controls unlock on the third red light.");
		gameEventBus.emit(GAME_EVENTS.SCENE_READY, { sceneKey: "Minigame 10" });
	}

	update(_time: number, delta: number) {
		if (this.gameStatus !== "playing") {
			this.updateHud();
			return;
		}

		if (!this.raceStarted) {
			this.preRaceMs += delta;
			this.updateLaunchLights();
			if (this.preRaceMs >= LAUNCH_LIGHT_INTERVAL_MS * 2) {
				this.raceStarted = true;
				this.message = "GO. Hold Accelerate and release to shift in the green band.";
				this.emitControls();
				this.emitState(this.message);
			}
			this.updateHud();
			return;
		}

		this.elapsedMs += delta;
		this.shiftFlashMs = Math.max(0, this.shiftFlashMs - delta);
		this.updatePlayer(delta / 1000);
		this.updateOpponent();
		this.updateCars();
		this.updateCamera();
		this.updateHud();

		const playerFinished = this.playerDistanceMeters >= RACE_DISTANCE_M;
		const opponentFinished = this.opponentDistanceMeters >= RACE_DISTANCE_M || this.elapsedMs >= this.opponentTargetTimeMs;

		if (playerFinished) {
			if (!opponentFinished || this.elapsedMs <= this.opponentTargetTimeMs) {
				this.finishRace("won", `You edged out the ${this.opponentProfile.name.toLowerCase()} with a ${(this.elapsedMs / 1000).toFixed(2)}s run.`);
			} else {
				this.finishRace("lost", `${this.opponentProfile.name} got there first. Release earlier and shift in the green band.`);
			}
			return;
		}

		if (opponentFinished) {
			this.finishRace("lost", `${this.opponentProfile.name} crossed in ${(this.opponentTargetTimeMs / 1000).toFixed(2)}s. Find cleaner upshifts.`);
			return;
		}

		if (this.elapsedMs >= ROUND_MAX_MS) {
			this.finishRace("lost", "The sprint dragged on too long. Stay on throttle and clean up the shifts.");
		}
	}

	private pickOpponent() {
		this.opponentProfile = Phaser.Utils.Array.GetRandom(OPPONENTS);
		const sampledTargetTimeMs = randomBetween(this.opponentProfile.targetMinMs, this.opponentProfile.targetMaxMs);
		this.opponentTargetTimeMs = sampledTargetTimeMs + (this.opponentProfile.badStartPenaltyMs ?? 0);

		if (
			this.opponentProfile.badStartPenaltyMs &&
			this.opponentProfile.badStartFraction &&
			this.opponentProfile.badStartAccelRatio
		) {
			this.opponentMotion = buildOpponentMotionWithBadStart(
				RACE_DISTANCE_M,
				this.opponentTargetTimeMs,
				this.opponentProfile.badStartFraction,
				this.opponentProfile.accelFraction,
				this.opponentProfile.badStartAccelRatio,
			);
			return;
		}

		const motion = buildOpponentMotion(RACE_DISTANCE_M, this.opponentTargetTimeMs, this.opponentProfile.accelFraction);
		this.opponentMotion = {
			badStartSeconds: 0,
			badStartAcceleration: 0,
			mainAccelSeconds: motion.accelTimeSeconds,
			mainAcceleration: motion.acceleration,
			maxSpeed: motion.maxSpeed,
		};
	}

	private setupEventBridge() {
		this.cleanupListeners.forEach((cleanup) => cleanup());
		this.cleanupListeners = [
			gameEventBus.on(GAME_EVENTS.MINIGAME10_THROTTLE, ({ active }) => {
				this.throttleActive = active;
				this.emitControls();
			}),
			gameEventBus.on(GAME_EVENTS.MINIGAME10_SHIFT, () => {
				this.tryShiftUp();
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

	private buildTrack() {
		this.launchLights = [];

		this.backgroundGraphics = this.add.graphics().setDepth(0);
		this.roadGraphics = this.add.graphics().setDepth(1);
		this.drawBackground();
		this.drawRoad();

		this.finishLine = this.add.rectangle(FINISH_WORLD_X + 28, 302, 14, 160, 0xffffff, 1).setDepth(2);
		this.finishLine2 = this.add.rectangle(FINISH_WORLD_X + 42, 302, 14, 160, 0x111111, 1).setDepth(2);

		this.playerCar = this.add.image(metersToWorldX(0), PLAYER_LANE_Y, "minigame10-orange-car").setDisplaySize(124, 62).setDepth(12);
		this.opponentCar = this.add.image(metersToWorldX(0), OPPONENT_LANE_Y, this.opponentProfile.texture).setDisplaySize(124, 62).setDepth(11);

		this.add.text(40, 26, "STREET SPRINT", { fontFamily: "Arial", fontSize: "28px", color: "#fff2df", fontStyle: "bold" }).setScrollFactor(0);
		this.opponentLabel = this.add.text(40, 58, `Opponent: ${this.opponentProfile.name}`, { fontFamily: "Arial", fontSize: "18px", color: "#ffd8b0" }).setScrollFactor(0);
		this.statusText = this.add.text(40, 90, "", { fontFamily: "Arial", fontSize: "16px", color: "#ffdcb6" }).setScrollFactor(0);

		this.speedText = this.add.text(734, 26, "0 km/h", { fontFamily: "Arial", fontSize: "32px", color: "#fff2df", fontStyle: "bold" }).setOrigin(1, 0).setScrollFactor(0);
		this.gearText = this.add.text(742, 70, "G1", { fontFamily: "Arial", fontSize: "22px", color: "#9de8ff", fontStyle: "bold" }).setOrigin(1, 0).setScrollFactor(0);
		this.rpmLabel = this.add.text(920, 72, "RPM", { fontFamily: "Arial", fontSize: "16px", color: "#ffd7a9", fontStyle: "bold" }).setOrigin(1, 0).setScrollFactor(0);
		this.rpmTrack = this.add.rectangle(714, 116, 220, 16, 0x121722, 0.95).setOrigin(0, 0.5).setStrokeStyle(1, 0xffffff, 0.15).setScrollFactor(0);
		this.rpmFill = this.add.rectangle(714, 116, 0, 10, 0x7cf0c4, 1).setOrigin(0, 0.5).setScrollFactor(0);
		this.shiftHint = this.add.text(714, 136, "Watch the lights", { fontFamily: "Arial", fontSize: "16px", color: "#ffd8b0", fontStyle: "bold" }).setScrollFactor(0);

		for (let index = 0; index < 3; index += 1) {
			const light = this.add.circle(370 + index * 48, 68, 15, 0x3b0e10, 0.95).setStrokeStyle(3, 0x6d262b, 0.8).setScrollFactor(0);
			this.launchLights.push(light);
		}

		this.updateLaunchLights();
	}

	private drawBackground() {
		if (!this.backgroundGraphics) {
			return;
		}

		const graphics = this.backgroundGraphics;
		graphics.clear();
		graphics.fillGradientStyle(0x112242, 0x112242, 0x0a1020, 0x0a1020, 1);
		graphics.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
		graphics.fillStyle(0x213455, 1);
		graphics.fillRect(0, 132, WORLD_WIDTH, 54);

		for (let x = -80; x < WORLD_WIDTH + 120; x += 108) {
			const index = Math.floor((x + 80) / 108);
			const buildingWidth = 34 + ((index % 3 + 3) % 3) * 12;
			const buildingHeight = 36 + ((index % 5 + 5) % 5) * 18;
			graphics.fillStyle(0x0d1828, 0.96);
			graphics.fillRect(x, 160 - buildingHeight, buildingWidth, buildingHeight);
			graphics.fillStyle(0xffd17a, 0.34);
			for (let row = 0; row < 4; row += 1) {
				for (let column = 0; column < 2; column += 1) {
					graphics.fillRect(x + 8 + column * 14, 166 - buildingHeight + row * 14, 5, 7);
				}
			}
		}

		graphics.fillStyle(0x2b292f, 1);
		graphics.fillRect(0, 184, WORLD_WIDTH, 12);

		for (let x = -40; x < WORLD_WIDTH + 120; x += 170) {
			graphics.fillStyle(0x4d4f59, 1);
			graphics.fillRect(x, 90, 6, 106);
			graphics.fillStyle(0x60697b, 1);
			graphics.fillRect(x - 15, 90, 30, 5);
			graphics.fillStyle(0xffe1a1, 0.98);
			graphics.fillCircle(x, 96, 7);
			graphics.fillStyle(0xffdf98, 0.16);
			graphics.fillTriangle(x - 52, 202, x + 52, 202, x, 108);
			graphics.fillStyle(0xffdf98, 0.08);
			graphics.fillCircle(x, 105, 30);
		}
	}

	private drawRoad() {
		if (!this.roadGraphics) {
			return;
		}

		const graphics = this.roadGraphics;
		graphics.clear();
		graphics.fillStyle(0x18191f, 1);
		graphics.fillRect(0, 214, WORLD_WIDTH, 206);
		graphics.fillStyle(0x40434b, 1);
		graphics.fillRect(0, 210, WORLD_WIDTH, 6);
		graphics.fillRect(0, 398, WORLD_WIDTH, 6);
		graphics.fillStyle(0xf1dfa0, 0.96);
		graphics.fillRect(0, 268, WORLD_WIDTH, 4);
		graphics.fillRect(0, 334, WORLD_WIDTH, 4);

		for (let x = 0; x < WORLD_WIDTH + 40; x += 78) {
			graphics.fillRect(x, 300, 38, 6);
		}
	}

	private startRace() {
		this.elapsedMs = 0;
		this.preRaceMs = 0;
		this.raceStarted = false;
		this.gameStatus = "playing";
		this.message = "Watch the lights. Controls unlock on the third red light.";
		this.throttleActive = false;
		this.playerSpeedMs = 0;
		this.playerDistanceMeters = 0;
		this.playerGear = 1;
		this.shiftFlashMs = 0;
		this.lastShiftQuality = 0;
		this.opponentDistanceMeters = 0;
		this.opponentSpeedMs = 0;
		this.updateLaunchLights();
		this.updateCars();
		this.updateCamera(true);
		this.updateHud();
	}

	private updatePlayer(dt: number) {
		const gear = GEARS[this.playerGear - 1];
		let acceleration = 0;

		if (this.throttleActive) {
			if (this.playerSpeedMs < gear.sweetMin) {
				acceleration = gear.acceleration;
			} else if (this.playerSpeedMs < gear.sweetMax) {
				acceleration = gear.acceleration * 0.92;
			} else if (this.playerSpeedMs < gear.maxSpeed) {
				acceleration = gear.acceleration * 0.3;
			} else {
				acceleration = -1.8;
			}
		} else {
			acceleration = -gear.coast;
		}

		this.playerSpeedMs = Phaser.Math.Clamp(this.playerSpeedMs + acceleration * dt, 0, 72);
		this.playerDistanceMeters = Math.min(RACE_DISTANCE_M, this.playerDistanceMeters + this.playerSpeedMs * dt);
	}

	private tryShiftUp() {
		if (this.gameStatus !== "playing" || !this.raceStarted || this.throttleActive || this.playerGear >= GEARS.length) {
			return;
		}

		const currentGear = GEARS[this.playerGear - 1];
		const nextGear = GEARS[this.playerGear];
		const sweetCenter = (currentGear.sweetMin + currentGear.sweetMax) / 2;
		const sweetHalf = (currentGear.sweetMax - currentGear.sweetMin) / 2;
		const distance = Math.abs(this.playerSpeedMs - sweetCenter);
		const quality = clamp01(1 - distance / (sweetHalf + 4.5));
		const speedBeforeShift = this.playerSpeedMs;

		this.playerGear += 1;
		this.lastShiftQuality = quality;
		this.shiftFlashMs = 700;
		this.playerSpeedMs = Phaser.Math.Clamp(
			Math.max(speedBeforeShift * (0.86 + quality * 0.12), nextGear.launchFloor + quality * 2.5),
			nextGear.launchFloor,
			nextGear.maxSpeed * 0.9,
		);

		if (quality >= 0.84) {
			this.message = "Perfect shift.";
		} else if (quality >= 0.56) {
			this.message = "Clean shift.";
		} else if (speedBeforeShift < sweetCenter) {
			this.message = "Too early. Let the revs climb a little longer.";
		} else {
			this.message = "Too late. You sat on the limiter too long.";
		}

		this.emitControls();
		this.emitState(this.message);
	}

	private updateOpponent() {
		const elapsedSeconds = this.elapsedMs / 1000;
		const badStartSeconds = this.opponentMotion.badStartSeconds;
		const mainAccelSeconds = this.opponentMotion.mainAccelSeconds;

		if (badStartSeconds > 0 && elapsedSeconds <= badStartSeconds) {
			this.opponentSpeedMs = this.opponentMotion.badStartAcceleration * elapsedSeconds;
			this.opponentDistanceMeters = 0.5 * this.opponentMotion.badStartAcceleration * elapsedSeconds * elapsedSeconds;
			return;
		}

		const badStartDistance = 0.5 * this.opponentMotion.badStartAcceleration * badStartSeconds * badStartSeconds;
		const speedAfterBadStart = this.opponentMotion.badStartAcceleration * badStartSeconds;

		if (elapsedSeconds <= badStartSeconds + mainAccelSeconds) {
			const accelSeconds = elapsedSeconds - badStartSeconds;
			this.opponentSpeedMs = speedAfterBadStart + this.opponentMotion.mainAcceleration * accelSeconds;
			this.opponentDistanceMeters =
				badStartDistance +
				speedAfterBadStart * accelSeconds +
				0.5 * this.opponentMotion.mainAcceleration * accelSeconds * accelSeconds;
			return;
		}

		this.opponentSpeedMs = this.opponentMotion.maxSpeed;
		const accelDistance =
			badStartDistance +
			speedAfterBadStart * mainAccelSeconds +
			0.5 * this.opponentMotion.mainAcceleration * mainAccelSeconds * mainAccelSeconds;
		const cruiseSeconds = elapsedSeconds - badStartSeconds - mainAccelSeconds;
		this.opponentDistanceMeters = Math.min(RACE_DISTANCE_M, accelDistance + this.opponentMotion.maxSpeed * cruiseSeconds);
	}

	private updateCars() {
		if (this.playerCar) {
			const squat = this.throttleActive ? -1.5 : 0;
			this.playerCar.setPosition(metersToWorldX(this.playerDistanceMeters), PLAYER_LANE_Y + squat);
		}

		if (this.opponentCar) {
			const bob = Math.sin(this.elapsedMs * 0.01) * 1.1;
			this.opponentCar.setPosition(metersToWorldX(this.opponentDistanceMeters), OPPONENT_LANE_Y + bob);
		}
	}

	private updateCamera(force = false) {
		if (!this.playerCar) {
			return;
		}

		const camera = this.cameras.main;
		const desiredScrollX = Phaser.Math.Clamp(this.playerCar.x - CAMERA_LEAD_OFFSET, 0, WORLD_WIDTH - camera.width);
		camera.scrollX = force ? desiredScrollX : Phaser.Math.Linear(camera.scrollX, desiredScrollX, CAMERA_LERP_X);
	}

	private updateLaunchLights() {
		const stage = this.raceStarted ? 3 : Math.min(3, Math.floor(this.preRaceMs / LAUNCH_LIGHT_INTERVAL_MS) + 1);
		this.launchLights.forEach((light, index) => {
			const active = index < stage;
			light.setFillStyle(active ? 0xff525d : 0x3b0e10, active ? 0.98 : 0.95);
			light.setStrokeStyle(3, active ? 0xffb0b5 : 0x6d262b, active ? 0.9 : 0.8);
			light.setScale(active ? 1.05 : 1);
		});
	}

	private updateHud() {
		const gear = GEARS[this.playerGear - 1];
		const rpmRatio = clamp01(this.playerSpeedMs / gear.maxSpeed);
		const sweetStart = gear.sweetMin / gear.maxSpeed;
		const sweetEnd = gear.sweetMax / gear.maxSpeed;

		this.speedText?.setText(`${Math.round(kmh(this.playerSpeedMs))} km/h`);
		this.gearText?.setText(`G${this.playerGear}`);
		this.statusText?.setText(this.message);
		this.rpmFill?.setSize(220 * rpmRatio, 10);

		if (this.rpmFill) {
			let color = 0x7cf0c4;
			if (rpmRatio >= sweetStart && rpmRatio <= sweetEnd) {
				color = 0x9df9a6;
			} else if (rpmRatio > sweetEnd) {
				color = 0xff8b6d;
			}
			this.rpmFill.fillColor = color;
		}

		if (!this.shiftHint) {
			return;
		}

		if (this.gameStatus !== "playing") {
			this.shiftHint.setText("Race finished");
			return;
		}

		if (!this.raceStarted) {
			this.shiftHint.setText(Math.floor(this.preRaceMs / LAUNCH_LIGHT_INTERVAL_MS) >= 2 ? "GO" : "Watch the lights");
			return;
		}

		if (this.playerGear >= GEARS.length) {
			this.shiftHint.setText("Top gear");
			return;
		}

		if (this.throttleActive) {
			if (rpmRatio >= sweetStart && rpmRatio <= sweetEnd) {
				this.shiftHint.setText("Release to shift now");
			} else {
				this.shiftHint.setText("Hold Accelerate");
			}
			return;
		}

		if (this.shiftFlashMs > 0) {
			this.shiftHint.setText(this.lastShiftQuality >= 0.84 ? "Perfect shift" : this.lastShiftQuality >= 0.56 ? "Clean shift" : "Find the green band");
			return;
		}

		if (rpmRatio >= sweetStart && rpmRatio <= sweetEnd) {
			this.shiftHint.setText("Shift Up");
		} else {
			this.shiftHint.setText("Hold Accelerate");
		}
	}

	private finishRace(status: "won" | "lost", message: string) {
		this.gameStatus = status;
		this.message = message;
		this.throttleActive = false;
		this.emitControls();
		this.emitState(message);
	}

	private emitControls() {
		const inactive = this.gameStatus !== "playing" || !this.raceStarted;
		gameEventBus.emit(GAME_EVENTS.MINIGAME10_CONTROLS, {
			accelerateDisabled: inactive,
			shiftDisabled: inactive || this.playerGear >= GEARS.length,
		});
	}

	private emitState(message: string) {
		gameEventBus.emit(GAME_EVENTS.GAME_STATE, {
			sceneKey: "Minigame 10",
			status: this.gameStatus,
			remainingChunks: 0,
			totalChunks: 0,
			elapsedMs: this.elapsedMs,
			message,
		});
	}
}
