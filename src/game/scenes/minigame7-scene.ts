import * as Phaser from "phaser";
import { GAME_EVENTS, gameEventBus } from "@/game/event-bus";

type PlaneType = "player" | "plane2" | "plane3" | "plane4";

type PlaneConfig = {
	texture: string;
	displaySize: number;
	minSpeed: number;
	maxSpeed: number;
	acceleration: number;
	turnSpeed: number;
	trailIntervalMs: number;
	trailScale: number;
};

type PlaneEntity = {
	id: number;
	type: PlaneType;
	isPlayer: boolean;
	sprite: Phaser.GameObjects.Image;
	heading: number;
	speed: number;
	radius: number;
	config: PlaneConfig;
	trailCooldownMs: number;
	destroyed: boolean;
	velocity: Phaser.Math.Vector2;
};

type TrailPuff = {
	sprite: Phaser.GameObjects.Image;
	ageMs: number;
	lifetimeMs: number;
	spin: number;
	drift: Phaser.Math.Vector2;
};

type ExplosionBurst = {
	sprite: Phaser.GameObjects.Image;
	ageMs: number;
	lifetimeMs: number;
	spin: number;
};

const SURVIVAL_TIME_MS = 20_000;
const WORLD_SIZE = 6_400;
const PLAYER_START = WORLD_SIZE / 2;
const PLAYER_HEADING = -Math.PI / 2;
const PLAYER_TURN_SPEED = Phaser.Math.DegToRad(112);
const PLAYER_MAX_SPEED = 230;
const PLAYER_ACCELERATION = 176;
const PLAYER_TRAIL_INTERVAL_MS = 60;
const CAMERA_LERP = 0.08;
const CAMERA_ZOOM = 0.62;
const BOOST_DURATION_MS = 2_000;
const BOOST_RECOVERY_MS = 100;
const BOOST_COOLDOWN_MS = 2_000;
const PLAYER_BOOST_SPEED = 304;
const PLAYER_RECOVERY_SPEED = 172;
const ENEMY_SPAWN_INTERVAL_MS = 1_250;
const ENEMY_SPAWN_RADIUS = 920;
const ENEMY_DESPAWN_RADIUS = 2_200;
const TRAIL_LIFETIME_MS = 420;
const EXPLOSION_LIFETIME_MS = 520;

const PLANE_CONFIGS: Record<PlaneType, PlaneConfig> = {
	player: {
		texture: "minigame7-plane1",
		displaySize: 86,
		minSpeed: 198,
		maxSpeed: PLAYER_MAX_SPEED,
		acceleration: PLAYER_ACCELERATION,
		turnSpeed: PLAYER_TURN_SPEED,
		trailIntervalMs: PLAYER_TRAIL_INTERVAL_MS,
		trailScale: 0.62,
	},
	plane2: {
		texture: "minigame7-plane2",
		displaySize: 82,
		minSpeed: 224,
		maxSpeed: 252,
		acceleration: 110,
		turnSpeed: Phaser.Math.DegToRad(42),
		trailIntervalMs: 82,
		trailScale: 0.56,
	},
	plane3: {
		texture: "minigame7-plane3",
		displaySize: 72,
		minSpeed: 268,
		maxSpeed: 320,
		acceleration: 180,
		turnSpeed: Phaser.Math.DegToRad(52),
		trailIntervalMs: 58,
		trailScale: 0.48,
	},
	plane4: {
		texture: "minigame7-plane4",
		displaySize: 96,
		minSpeed: 246,
		maxSpeed: 286,
		acceleration: 130,
		turnSpeed: Phaser.Math.DegToRad(48),
		trailIntervalMs: 72,
		trailScale: 0.68,
	},
};

function wrapAngle(angle: number) {
	return Phaser.Math.Angle.Wrap(angle);
}

function moveToward(current: number, target: number, maxDelta: number) {
	if (Math.abs(target - current) <= maxDelta) {
		return target;
	}

	return current + Math.sign(target - current) * maxDelta;
}

export class Minigame7Scene extends Phaser.Scene {
	private cleanupListeners: Array<() => void> = [];
	private backgroundGraphics?: Phaser.GameObjects.Graphics;
	private playerPlane?: PlaneEntity;
	private enemyPlanes: PlaneEntity[] = [];
	private trailPuffs: TrailPuff[] = [];
	private explosions: ExplosionBurst[] = [];
	private turnInput = { left: false, right: false };
	private boostMs = 0;
	private boostRecoveryMs = 0;
	private boostCooldownMs = 0;
	private controlsSignature = "";
	private matchElapsedMs = 0;
	private spawnElapsedMs = 0;
	private hudLastEmittedAt = 0;
	private nextPlaneId = 0;
	private gameStatus: "booting" | "playing" | "won" | "lost" = "booting";
	private message = "Booting Phaser bridge...";

	constructor() {
		super("minigame7");
	}

	create() {
		this.cameras.main.setBackgroundColor("#70c8ff");
		this.cameras.main.setZoom(CAMERA_ZOOM);
		this.setupEventBridge();
		this.ensureGeneratedTextures();
		this.buildWorld();
		this.startRound();
		this.emitControls();
		gameEventBus.emit(GAME_EVENTS.SCENE_READY, { sceneKey: "Minigame 7" });
	}

	update(_time: number, delta: number) {
		if (this.gameStatus !== "playing" || !this.playerPlane) {
			this.updateEffects(delta);
			return;
		}

		this.matchElapsedMs += delta;
		this.spawnElapsedMs += delta;
		this.updateBoostState(delta);

		const dt = delta / 1000;
		this.updatePlayer(dt, delta);
		this.updateEnemies(dt, delta);
		this.updateEffects(delta);
		this.handleCollisions();

		if (this.gameStatus !== "playing") {
			return;
		}

		if (this.spawnElapsedMs >= ENEMY_SPAWN_INTERVAL_MS) {
			this.spawnElapsedMs -= ENEMY_SPAWN_INTERVAL_MS;
			this.spawnEnemyPlane();
		}

		if (this.matchElapsedMs - this.hudLastEmittedAt >= 120) {
			this.emitState(this.message);
			this.hudLastEmittedAt = this.matchElapsedMs;
		}

		this.emitControls();

		if (this.matchElapsedMs >= SURVIVAL_TIME_MS) {
			this.finishRound("won", "You outran the pack and stayed airborne for the full twenty seconds.");
		}
	}

	private setupEventBridge() {
		this.cleanupListeners.forEach((cleanup) => cleanup());
		this.cleanupListeners = [
			gameEventBus.on(GAME_EVENTS.MINIGAME7_TURN, ({ left, right }) => {
				this.turnInput.left = left;
				this.turnInput.right = right;
			}),
			gameEventBus.on(GAME_EVENTS.MINIGAME7_BOOST, () => {
				this.triggerBoost();
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

	private ensureGeneratedTextures() {
		if (this.textures.exists("minigame7-trail-dot") && this.textures.exists("minigame7-trail-dot-dark")) {
			return;
		}

		const graphics = this.add.graphics();
		graphics.setVisible(false);
		graphics.fillStyle(0xffffff, 0.92);
		graphics.fillCircle(12, 12, 10);
		graphics.fillStyle(0xdff7ff, 0.85);
		graphics.fillCircle(8, 8, 5);
		graphics.generateTexture("minigame7-trail-dot", 24, 24);
		graphics.clear();
		graphics.fillStyle(0x576574, 0.94);
		graphics.fillCircle(12, 12, 10);
		graphics.fillStyle(0x334155, 0.88);
		graphics.fillCircle(9, 9, 6);
		graphics.generateTexture("minigame7-trail-dot-dark", 24, 24);
		graphics.destroy();
	}

	private buildWorld() {
		this.cameras.main.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE);

		this.backgroundGraphics = this.add.graphics().setDepth(0);
		this.backgroundGraphics.fillStyle(0x67c8ff, 1);
		this.backgroundGraphics.fillRect(0, 0, WORLD_SIZE, WORLD_SIZE);

		const rng = new Phaser.Math.RandomDataGenerator(["minigame7-clouds"]);
		this.backgroundGraphics.fillStyle(0x2d88bf, 0.18);
		for (let index = 0; index < 120; index += 1) {
			const x = rng.realInRange(140, WORLD_SIZE - 140);
			const y = rng.realInRange(140, WORLD_SIZE - 140);
			this.backgroundGraphics.fillEllipse(x, y, rng.realInRange(46, 120), rng.realInRange(12, 24));
		}

		for (let gridX = 220; gridX < WORLD_SIZE; gridX += 420) {
			for (let gridY = 180; gridY < WORLD_SIZE; gridY += 360) {
				if (rng.frac() > 0.36) {
					continue;
				}

				const centerX = gridX + rng.realInRange(-120, 120);
				const centerY = gridY + rng.realInRange(-96, 96);
				const puffCount = Phaser.Math.Between(3, 6);
				for (let puffIndex = 0; puffIndex < puffCount; puffIndex += 1) {
					const radiusX = rng.realInRange(54, 110);
					const radiusY = radiusX * rng.realInRange(0.48, 0.74);
					const offsetAngle = rng.realInRange(0, Math.PI * 2);
					const offsetDistance = rng.realInRange(0, 36);
					const alpha = rng.realInRange(0.16, 0.28);
					this.backgroundGraphics.fillStyle(0xffffff, alpha);
					this.backgroundGraphics.fillEllipse(
						centerX + Math.cos(offsetAngle) * offsetDistance,
						centerY + Math.sin(offsetAngle) * offsetDistance,
						radiusX,
						radiusY,
					);
				}
			}
		}
	}

	private startRound() {
		this.matchElapsedMs = 0;
		this.spawnElapsedMs = 0;
		this.hudLastEmittedAt = 0;
		this.nextPlaneId = 0;
		this.turnInput = { left: false, right: false };
		this.boostMs = 0;
		this.boostRecoveryMs = 0;
		this.boostCooldownMs = 0;
		this.controlsSignature = "";
		this.enemyPlanes.forEach((plane) => plane.sprite.destroy());
		this.enemyPlanes = [];
		this.trailPuffs.forEach((trail) => trail.sprite.destroy());
		this.trailPuffs = [];
		this.explosions.forEach((explosion) => explosion.sprite.destroy());
		this.explosions = [];
		this.playerPlane?.sprite.destroy();

		const playerConfig = PLANE_CONFIGS.player;
		const playerSprite = this.add.image(PLAYER_START, PLAYER_START, playerConfig.texture).setDepth(10);
		playerSprite.setDisplaySize(playerConfig.displaySize, playerConfig.displaySize);
		playerSprite.setRotation(PLAYER_HEADING + Math.PI / 2);

		this.playerPlane = {
			id: this.nextPlaneId,
			type: "player",
			isPlayer: true,
			sprite: playerSprite,
			heading: PLAYER_HEADING,
			speed: playerConfig.minSpeed,
			radius: playerConfig.displaySize / 2,
			config: playerConfig,
			trailCooldownMs: 0,
			destroyed: false,
			velocity: new Phaser.Math.Vector2(0, -playerConfig.minSpeed),
		};
		this.nextPlaneId += 1;

		this.cameras.main.startFollow(playerSprite, true, CAMERA_LERP, CAMERA_LERP);
		this.gameStatus = "playing";
		this.message = "Bank left and right to thread through the incoming planes.";
		this.emitState(this.message);
		this.emitControls();
	}

	private updateBoostState(delta: number) {
		if (this.boostMs > 0) {
			this.boostMs = Math.max(0, this.boostMs - delta);
			if (this.boostMs === 0) {
				this.boostRecoveryMs = BOOST_RECOVERY_MS;
			}
		}

		if (this.boostRecoveryMs > 0) {
			this.boostRecoveryMs = Math.max(0, this.boostRecoveryMs - delta);
			if (this.boostRecoveryMs === 0) {
				this.boostCooldownMs = BOOST_COOLDOWN_MS;
			}
		}

		if (this.boostCooldownMs > 0) {
			this.boostCooldownMs = Math.max(0, this.boostCooldownMs - delta);
		}
	}

	private triggerBoost() {
		if (this.gameStatus !== "playing" || !this.playerPlane) {
			return;
		}

		if (this.boostMs > 0 || this.boostRecoveryMs > 0 || this.boostCooldownMs > 0) {
			return;
		}

		this.boostMs = BOOST_DURATION_MS;
		this.boostRecoveryMs = 0;
		this.boostCooldownMs = 0;
		this.emitControls();
	}

	private updatePlayer(dt: number, delta: number) {
		if (!this.playerPlane || this.playerPlane.destroyed) {
			return;
		}

		const turnDirection = (this.turnInput.right ? 1 : 0) - (this.turnInput.left ? 1 : 0);
		this.playerPlane.heading = wrapAngle(this.playerPlane.heading + turnDirection * this.playerPlane.config.turnSpeed * dt);
		const targetSpeed = this.boostMs > 0
			? PLAYER_BOOST_SPEED
			: this.boostRecoveryMs > 0
				? PLAYER_RECOVERY_SPEED
				: this.playerPlane.config.maxSpeed;
		const minSpeed = this.boostRecoveryMs > 0 ? PLAYER_RECOVERY_SPEED : this.playerPlane.config.minSpeed;
		const maxSpeed = this.boostMs > 0 ? PLAYER_BOOST_SPEED : this.playerPlane.config.maxSpeed;
		this.playerPlane.speed = moveToward(this.playerPlane.speed, targetSpeed, this.playerPlane.config.acceleration * dt * 2.4);
		this.playerPlane.speed = Phaser.Math.Clamp(this.playerPlane.speed, minSpeed, maxSpeed);

		this.updatePlaneMotion(this.playerPlane, delta, dt);
	}

	private updateEnemies(dt: number, delta: number) {
		if (!this.playerPlane) {
			return;
		}

		for (const enemy of this.enemyPlanes) {
			if (enemy.destroyed) {
				continue;
			}

			const desiredHeading = Phaser.Math.Angle.Between(
				enemy.sprite.x,
				enemy.sprite.y,
				this.playerPlane.sprite.x,
				this.playerPlane.sprite.y,
			);
			enemy.heading = Phaser.Math.Angle.RotateTo(enemy.heading, desiredHeading, enemy.config.turnSpeed * dt);
			enemy.speed = moveToward(enemy.speed, enemy.config.maxSpeed, enemy.config.acceleration * dt);
			enemy.speed = Phaser.Math.Clamp(enemy.speed, enemy.config.minSpeed, enemy.config.maxSpeed);
			this.updatePlaneMotion(enemy, delta, dt);

			if (Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, this.playerPlane.sprite.x, this.playerPlane.sprite.y) > ENEMY_DESPAWN_RADIUS) {
				enemy.destroyed = true;
				enemy.sprite.destroy();
			}
		}

		this.enemyPlanes = this.enemyPlanes.filter((enemy) => !enemy.destroyed);
	}

	private updatePlaneMotion(plane: PlaneEntity, delta: number, dt: number) {
		const velocityX = Math.cos(plane.heading) * plane.speed;
		const velocityY = Math.sin(plane.heading) * plane.speed;
		plane.velocity.set(velocityX, velocityY);
		plane.sprite.x = Phaser.Math.Clamp(plane.sprite.x + velocityX * dt, 80, WORLD_SIZE - 80);
		plane.sprite.y = Phaser.Math.Clamp(plane.sprite.y + velocityY * dt, 80, WORLD_SIZE - 80);
		plane.sprite.setRotation(plane.heading + Math.PI / 2);

		plane.trailCooldownMs -= delta;
		if (plane.trailCooldownMs <= 0) {
			plane.trailCooldownMs += plane.config.trailIntervalMs;
			this.spawnTrail(plane);
		}
	}

	private spawnEnemyPlane() {
		if (!this.playerPlane || this.playerPlane.destroyed) {
			return;
		}

		const enemyType = Phaser.Utils.Array.GetRandom<PlaneType>(["plane2", "plane3", "plane4"]);
		const config = PLANE_CONFIGS[enemyType];
		const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
		const x = this.playerPlane.sprite.x + Math.cos(angle) * ENEMY_SPAWN_RADIUS;
		const y = this.playerPlane.sprite.y + Math.sin(angle) * ENEMY_SPAWN_RADIUS;
		const heading = Phaser.Math.Angle.Between(x, y, this.playerPlane.sprite.x, this.playerPlane.sprite.y);
		const sprite = this.add.image(x, y, config.texture).setDepth(10);
		sprite.setDisplaySize(config.displaySize, config.displaySize);
		sprite.setRotation(heading + Math.PI / 2);

		this.enemyPlanes.push({
			id: this.nextPlaneId,
			type: enemyType,
			isPlayer: false,
			sprite,
			heading,
			speed: config.minSpeed,
			radius: config.displaySize / 2,
			config,
			trailCooldownMs: Phaser.Math.Between(20, config.trailIntervalMs),
			destroyed: false,
			velocity: new Phaser.Math.Vector2(Math.cos(heading) * config.minSpeed, Math.sin(heading) * config.minSpeed),
		});
		this.nextPlaneId += 1;
	}

	private spawnTrail(plane: PlaneEntity) {
		const offsetX = Math.cos(plane.heading) * plane.radius * 0.76;
		const offsetY = Math.sin(plane.heading) * plane.radius * 0.76;
		const trailTexture = plane.isPlayer && this.boostMs > 0 ? "minigame7-trail-dot-dark" : "minigame7-trail-dot";
		const sprite = this.add.image(plane.sprite.x - offsetX, plane.sprite.y - offsetY, trailTexture).setDepth(6);
		const scale = plane.config.trailScale * Phaser.Math.FloatBetween(0.82, 1.14);
		sprite.setScale(scale);
		sprite.setAlpha(Phaser.Math.FloatBetween(trailTexture === "minigame7-trail-dot-dark" ? 0.42 : 0.34, trailTexture === "minigame7-trail-dot-dark" ? 0.66 : 0.58));

		this.trailPuffs.push({
			sprite,
			ageMs: 0,
			lifetimeMs: TRAIL_LIFETIME_MS,
			spin: Phaser.Math.FloatBetween(-0.02, 0.02),
			drift: new Phaser.Math.Vector2(Phaser.Math.FloatBetween(-8, 8), Phaser.Math.FloatBetween(-10, 6)),
		});
	}

	private updateEffects(delta: number) {
		const dt = delta / 1000;

		for (const trail of this.trailPuffs) {
			trail.ageMs += delta;
			trail.sprite.x += trail.drift.x * dt;
			trail.sprite.y += trail.drift.y * dt;
			trail.sprite.rotation += trail.spin;
			trail.sprite.setAlpha(Math.max(0, 1 - trail.ageMs / trail.lifetimeMs) * 0.55);
			trail.sprite.setScale(trail.sprite.scaleX + dt * 0.12, trail.sprite.scaleY + dt * 0.12);
		}

		this.trailPuffs = this.trailPuffs.filter((trail) => {
			if (trail.ageMs < trail.lifetimeMs) {
				return true;
			}

			trail.sprite.destroy();
			return false;
		});

		for (const explosion of this.explosions) {
			explosion.ageMs += delta;
			explosion.sprite.rotation += explosion.spin;
			explosion.sprite.setAlpha(Math.max(0, 1 - explosion.ageMs / explosion.lifetimeMs));
			explosion.sprite.setScale(explosion.sprite.scaleX + dt * 0.55, explosion.sprite.scaleY + dt * 0.55);
		}

		this.explosions = this.explosions.filter((explosion) => {
			if (explosion.ageMs < explosion.lifetimeMs) {
				return true;
			}

			explosion.sprite.destroy();
			return false;
		});
	}

	private handleCollisions() {
		if (!this.playerPlane) {
			return;
		}

		const activePlanes = [this.playerPlane, ...this.enemyPlanes].filter((plane) => !plane.destroyed);
		const collidedPlanes = new Set<PlaneEntity>();

		for (let index = 0; index < activePlanes.length; index += 1) {
			for (let compareIndex = index + 1; compareIndex < activePlanes.length; compareIndex += 1) {
				const first = activePlanes[index];
				const second = activePlanes[compareIndex];
				const distance = Phaser.Math.Distance.Between(first.sprite.x, first.sprite.y, second.sprite.x, second.sprite.y);

				if (distance <= first.radius + second.radius) {
					collidedPlanes.add(first);
					collidedPlanes.add(second);
				}
			}
		}

		if (collidedPlanes.size === 0) {
			return;
		}

		let playerDestroyed = false;
		for (const plane of collidedPlanes) {
			if (plane.destroyed) {
				continue;
			}

			this.destroyPlane(plane);
			playerDestroyed = playerDestroyed || plane.isPlayer;
		}

		if (playerDestroyed) {
			this.finishRound("lost", "Your plane was torn apart in the collision. Splashdown.");
		}
	}

	private destroyPlane(plane: PlaneEntity) {
		plane.destroyed = true;
		const explosion = this.add.image(plane.sprite.x, plane.sprite.y, "minigame7-explosion").setDepth(12);
		explosion.setDisplaySize(plane.radius * 2.6, plane.radius * 2.6);
		explosion.setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));
		this.explosions.push({
			sprite: explosion,
			ageMs: 0,
			lifetimeMs: EXPLOSION_LIFETIME_MS,
			spin: Phaser.Math.FloatBetween(-0.03, 0.03),
		});
		plane.sprite.destroy();
		if (!plane.isPlayer) {
			this.enemyPlanes = this.enemyPlanes.filter((enemy) => enemy.id !== plane.id);
		}
	}

	private emitState(message: string) {
		gameEventBus.emit(GAME_EVENTS.GAME_STATE, {
			sceneKey: "Minigame 7",
			status: this.gameStatus,
			remainingChunks: Math.max(0, Math.ceil((SURVIVAL_TIME_MS - this.matchElapsedMs) / 1000)),
			totalChunks: 20,
			elapsedMs: this.matchElapsedMs,
			message,
		});
	}

	private emitControls() {
		const boostDisabled = this.gameStatus !== "playing" || this.boostMs > 0 || this.boostRecoveryMs > 0 || this.boostCooldownMs > 0;
		const signature = JSON.stringify({ boostDisabled });
		if (signature === this.controlsSignature) {
			return;
		}

		this.controlsSignature = signature;
		gameEventBus.emit(GAME_EVENTS.MINIGAME7_CONTROLS, { boostDisabled });
	}

	private finishRound(status: "won" | "lost", message: string) {
		if (this.gameStatus !== "playing") {
			return;
		}

		this.gameStatus = status;
		this.turnInput = { left: false, right: false };
		this.message = message;
		this.emitState(message);
		this.emitControls();
	}
}