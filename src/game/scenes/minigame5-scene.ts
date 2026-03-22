import * as Phaser from "phaser";
import { GAME_EVENTS, gameEventBus } from "@/game/event-bus";

type EnemyOutcome = "perfect" | "one-point" | "miss" | "lance-strike";
type PlayerHit = "perfect" | "two-point" | "one-point" | "horse" | "miss";
type RunPhase = "booting" | "charge" | "resolve" | "complete";
type MarkerFeedback = "none" | "perfect" | "two-point" | "one-point" | "horse" | "miss";

const TOTAL_RUNS = 3;
const RUN_DURATION_MS = 4200;
const PLAYER_KNIGHT_X = 334;
const PLAYER_KNIGHT_Y = 434;
const PLAYER_KNIGHT_SCALE = 0.56;
const ENEMY_START_X = 670;
const ENEMY_END_X = 614;
const ENEMY_START_Y = 296;
const ENEMY_END_Y = 352;
const ENEMY_START_SCALE = 0.28;
const ENEMY_END_SCALE = 0.61;
const AIM_LEFT = 494;
const AIM_RIGHT = 736;
const AIM_TOP = 120;
const AIM_BOTTOM = 476;
const AIM_ACCELERATION = 760;
const AIM_MAX_SPEED = 290;
const AIM_DAMPING = 0.982;

function pointInEllipse(pointX: number, pointY: number, centerX: number, centerY: number, radiusX: number, radiusY: number) {
	const normalizedX = (pointX - centerX) / radiusX;
	const normalizedY = (pointY - centerY) / radiusY;
	return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
}

function pointInRect(pointX: number, pointY: number, centerX: number, centerY: number, width: number, height: number) {
	const halfWidth = width / 2;
	const halfHeight = height / 2;
	return (
		pointX >= centerX - halfWidth &&
		pointX <= centerX + halfWidth &&
		pointY >= centerY - halfHeight &&
		pointY <= centerY + halfHeight
	);
}

function getTargetLayout(enemyX: number, enemyY: number, enemyScale: number) {
	return {
		headX: enemyX,
		headY: enemyY - 252 * enemyScale,
		headRadius: 24 * enemyScale,
		bodyX: enemyX,
		bodyY: enemyY - 118 * enemyScale,
		bodyInnerRectY: enemyY - 144 * enemyScale,
		bodyInnerWidth: 52 * enemyScale,
		bodyInnerHeight: 42 * enemyScale,
		bodyOuterRadiusX: 80 * enemyScale,
		bodyOuterRadiusY: 96 * enemyScale,
		horseX: enemyX,
		horseY: enemyY + 98 * enemyScale,
		horseRadiusX: 72 * enemyScale,
		horseRadiusY: 52 * enemyScale,
	};
}

export class Minigame5Scene extends Phaser.Scene {
	private cleanupListeners: Array<() => void> = [];
	private inputVector = new Phaser.Math.Vector2();
	private aimPosition = new Phaser.Math.Vector2(ENEMY_END_X, ENEMY_END_Y - 54);
	private aimVelocity = new Phaser.Math.Vector2();
	private driftForce = new Phaser.Math.Vector2();
	private targetDriftForce = new Phaser.Math.Vector2();
	private nextDriftShiftAt = 0;
	private matchElapsedMs = 0;
	private runElapsedMs = 0;
	private hudLastEmittedAt = 0;
	private runNumber = 0;
	private playerScore = 0;
	private enemyScore = 0;
	private gameStatus: "booting" | "playing" | "won" | "lost" = "booting";
	private runPhase: RunPhase = "booting";
	private currentEnemyOutcome: EnemyOutcome = "one-point";
	private markerFeedback: MarkerFeedback = "none";
	private backgroundGraphics?: Phaser.GameObjects.Graphics;
	private fieldGraphics?: Phaser.GameObjects.Graphics;
	private dynamicGraphics?: Phaser.GameObjects.Graphics;
	private playerKnight?: Phaser.GameObjects.Image;
	private enemyKnight?: Phaser.GameObjects.Image;
	private playerShadow?: Phaser.GameObjects.Ellipse;
	private enemyShadow?: Phaser.GameObjects.Ellipse;
	private nextRunTimer?: Phaser.Time.TimerEvent;

	constructor() {
		super("minigame5");
	}

	create() {
		this.cameras.main.setBackgroundColor("#140f0b");
		this.setupEventBridge();
		this.buildBackdrop();
		this.createSprites();
		this.startMatch();

		gameEventBus.emit(GAME_EVENTS.SCENE_READY, { sceneKey: "Minigame 5" });
	}

	update(time: number, delta: number) {
		if (!this.dynamicGraphics) {
			return;
		}

		if (this.gameStatus === "playing") {
			this.matchElapsedMs += delta;
		}

		this.updateRiderBob(time);
		this.renderDynamicScene(time);

		if (this.gameStatus !== "playing" || this.runPhase !== "charge") {
			return;
		}

		this.runElapsedMs += delta;
		this.updateEnemyPose(time);
		this.updateAim(time, delta);

		if (this.runElapsedMs >= RUN_DURATION_MS) {
			this.resolveRun();
			return;
		}

		if (time - this.hudLastEmittedAt > 120) {
			this.emitState(this.getProgressMessage());
			this.hudLastEmittedAt = time;
		}
	}

	private setupEventBridge() {
		this.cleanupListeners.forEach((cleanup) => cleanup());
		this.cleanupListeners = [
			gameEventBus.on(GAME_EVENTS.INPUT_MOVE, ({ x, y }) => {
				this.inputVector.set(x, y);
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

	private buildBackdrop() {
		const { width, height } = this.scale;

		this.backgroundGraphics = this.add.graphics();
		this.fieldGraphics = this.add.graphics();
		this.dynamicGraphics = this.add.graphics();
		this.backgroundGraphics.setDepth(0);
		this.fieldGraphics.setDepth(4);
		this.dynamicGraphics.setDepth(20);

		this.backgroundGraphics.fillGradientStyle(0xf6c98f, 0xf6c98f, 0x7e4b31, 0x5d2f1a, 1);
		this.backgroundGraphics.fillRect(0, 0, width, height);
		this.backgroundGraphics.fillStyle(0xfff0d2, 0.3);
		this.backgroundGraphics.fillCircle(726, 104, 58);
		this.backgroundGraphics.fillStyle(0x6a4432, 0.55);
		this.backgroundGraphics.fillEllipse(192, 210, 360, 126);
		this.backgroundGraphics.fillEllipse(472, 194, 420, 140);
		this.backgroundGraphics.fillEllipse(800, 216, 380, 120);
		this.backgroundGraphics.fillStyle(0x33461f, 0.9);
		this.backgroundGraphics.fillRect(0, 236, width, 38);
		this.backgroundGraphics.fillStyle(0x977149, 1);
		this.backgroundGraphics.fillRect(0, 274, width, height - 274);
		this.backgroundGraphics.fillStyle(0xb88752, 1);
		this.backgroundGraphics.fillRect(0, 358, width, height - 358);

		for (let index = 0; index < 12; index += 1) {
			const bannerX = 34 + index * 82;
			const top = 112 + (index % 2) * 8;
			this.backgroundGraphics.fillStyle(index % 2 === 0 ? 0x8c1d1d : 0x1b3f79, 0.9);
			this.backgroundGraphics.fillRect(bannerX, top, 12, 72);
			this.backgroundGraphics.fillTriangle(bannerX + 12, top + 4, bannerX + 48, top + 16, bannerX + 12, top + 32);
		}

		this.fieldGraphics.fillStyle(0x4f2d18, 1);
		this.fieldGraphics.fillRect(472, 162, 18, 372);
		this.fieldGraphics.fillStyle(0xe7d6ba, 1);
		this.fieldGraphics.fillRect(476, 168, 10, 360);

		this.add
			.text(width / 2, 42, "JOUST ROYALE", {
				fontFamily: "Arial",
				fontSize: "30px",
				color: "#fff3dd",
			})
			.setOrigin(0.5);
	}

	private createSprites() {
		this.playerKnight = this.add.image(PLAYER_KNIGHT_X, PLAYER_KNIGHT_Y, "player-knight-sprite");
		this.playerKnight.setScale(PLAYER_KNIGHT_SCALE);
		this.playerKnight.setDepth(8);

		this.enemyKnight = this.add.image(ENEMY_START_X, ENEMY_START_Y, "enemy-knight-sprite");
		this.enemyKnight.setScale(ENEMY_START_SCALE);
		this.enemyKnight.setDepth(12);

		this.playerShadow = this.add.ellipse(PLAYER_KNIGHT_X, 528, 184, 34, 0x000000, 0.22);
		this.playerShadow.setDepth(7);
		this.enemyShadow = this.add.ellipse(ENEMY_START_X, 480, 82, 16, 0x000000, 0.16);
		this.enemyShadow.setDepth(9);
	}

	private startMatch() {
		this.gameStatus = "playing";
		this.runPhase = "charge";
		this.matchElapsedMs = 0;
		this.hudLastEmittedAt = 0;
		this.runNumber = 0;
		this.playerScore = 0;
		this.enemyScore = 0;
		this.inputVector.set(0, 0);
		this.aimVelocity.set(0, 0);
		this.startNextRun();
	}

	private startNextRun() {
		this.nextRunTimer?.destroy();
		this.runNumber += 1;
		this.runElapsedMs = 0;
		this.runPhase = "charge";
		this.currentEnemyOutcome = this.rollEnemyOutcome();
		this.aimPosition.set(ENEMY_END_X, ENEMY_END_Y - 54 + Phaser.Math.Between(-22, 22));
		this.aimVelocity.set(0, 0);
		this.driftForce.set(0, 0);
		this.targetDriftForce.set(0, 0);
		this.nextDriftShiftAt = this.time.now + Phaser.Math.Between(320, 620);
		this.updateEnemyPose(this.time.now);
		this.markerFeedback = "none";
		this.emitState(`Pass ${this.runNumber}/${TOTAL_RUNS}. Steady the marker on the rival. Score ${this.playerScore}-${this.enemyScore}.`);
	}

	private updateEnemyPose(time: number) {
		if (!this.enemyKnight || !this.enemyShadow) {
			return;
		}

		const progress = Phaser.Math.Clamp(this.runElapsedMs / RUN_DURATION_MS, 0, 1);
		const eased = progress;
		const sway = Math.sin(progress * Math.PI * 2.2) * (1 - progress) * 10;
		const bob = Math.sin(time * 0.017 + progress * 8) * 4;

		this.enemyKnight.x = Phaser.Math.Linear(ENEMY_START_X, ENEMY_END_X, eased) + sway;
		this.enemyKnight.y = Phaser.Math.Linear(ENEMY_START_Y, ENEMY_END_Y, eased) + bob;
		this.enemyKnight.setScale(Phaser.Math.Linear(ENEMY_START_SCALE, ENEMY_END_SCALE, eased));

		this.enemyShadow.x = this.enemyKnight.x;
		this.enemyShadow.y = Phaser.Math.Linear(470, 504, eased);
		this.enemyShadow.scaleX = Phaser.Math.Linear(0.82, 1.36, eased);
		this.enemyShadow.scaleY = Phaser.Math.Linear(0.8, 1.22, eased);
		this.enemyShadow.alpha = Phaser.Math.Linear(0.11, 0.28, eased);
	}

	private updateRiderBob(time: number) {
		if (this.playerKnight) {
			this.playerKnight.y = PLAYER_KNIGHT_Y + Math.sin(time * 0.016) * 5;
		}

		if (this.playerShadow) {
			this.playerShadow.scaleY = 1 + Math.sin(time * 0.016) * -0.05;
		}
	}

	private updateAim(time: number, delta: number) {
		const dt = delta / 1000;

		if (time >= this.nextDriftShiftAt) {
			const angle = Phaser.Math.FloatBetween(-Math.PI, Math.PI);
			const magnitude = Phaser.Math.FloatBetween(90, 210);
			this.targetDriftForce.set(Math.cos(angle) * magnitude, Math.sin(angle) * magnitude);
			this.nextDriftShiftAt = time + Phaser.Math.Between(320, 760);
		}

		const driftBlend = 1 - Math.pow(0.988, delta / 16.6667);
		this.driftForce.x = Phaser.Math.Linear(this.driftForce.x, this.targetDriftForce.x, driftBlend);
		this.driftForce.y = Phaser.Math.Linear(this.driftForce.y, this.targetDriftForce.y, driftBlend);

		this.aimVelocity.x += (this.inputVector.x * AIM_ACCELERATION + this.driftForce.x) * dt;
		this.aimVelocity.y += (this.inputVector.y * AIM_ACCELERATION + this.driftForce.y) * dt;
		this.aimVelocity.scale(Math.pow(AIM_DAMPING, delta / 16.6667));

		if (this.aimVelocity.length() > AIM_MAX_SPEED) {
			this.aimVelocity.setLength(AIM_MAX_SPEED);
		}

		this.aimPosition.x += this.aimVelocity.x * dt;
		this.aimPosition.y += this.aimVelocity.y * dt;

		if (this.aimPosition.x < AIM_LEFT || this.aimPosition.x > AIM_RIGHT) {
			this.aimPosition.x = Phaser.Math.Clamp(this.aimPosition.x, AIM_LEFT, AIM_RIGHT);
			this.aimVelocity.x *= -0.18;
		}

		if (this.aimPosition.y < AIM_TOP || this.aimPosition.y > AIM_BOTTOM) {
			this.aimPosition.y = Phaser.Math.Clamp(this.aimPosition.y, AIM_TOP, AIM_BOTTOM);
			this.aimVelocity.y *= -0.18;
		}
	}

	private renderDynamicScene(time: number) {
		if (!this.dynamicGraphics) {
			return;
		}

		const pulse = 0.76 + (Math.sin(time * 0.01) + 1) * 0.12;

		this.dynamicGraphics.clear();

		if (this.runPhase === "charge") {
			this.dynamicGraphics.fillStyle(0xfff8da, 0.18 * pulse);
			this.dynamicGraphics.fillCircle(this.aimPosition.x, this.aimPosition.y, 22);
			this.dynamicGraphics.fillStyle(0xfff1bb, 0.92);
			this.dynamicGraphics.fillCircle(this.aimPosition.x, this.aimPosition.y, 7);
			this.dynamicGraphics.lineStyle(1.5, 0x4a2313, 0.34);
			this.dynamicGraphics.strokeCircle(this.aimPosition.x, this.aimPosition.y, 22);
			return;
		}

		this.renderMarkerFeedback();
	}

	private renderMarkerFeedback() {
		if (!this.dynamicGraphics || this.markerFeedback === "none" || this.markerFeedback === "miss") {
			return;
		}

		if (this.markerFeedback === "horse") {
			this.dynamicGraphics.lineStyle(6, 0xff5a5a, 0.95);
			this.dynamicGraphics.strokeCircle(this.aimPosition.x, this.aimPosition.y, 20);
			return;
		}

		const color =
			this.markerFeedback === "perfect"
				? 0xffe37a
				: this.markerFeedback === "two-point"
					? 0x27d14d
					: 0x59b8ff;

		this.dynamicGraphics.lineStyle(6, color, 0.95);
		this.dynamicGraphics.beginPath();
		this.dynamicGraphics.moveTo(this.aimPosition.x - 16, this.aimPosition.y - 16);
		this.dynamicGraphics.lineTo(this.aimPosition.x + 16, this.aimPosition.y + 16);
		this.dynamicGraphics.moveTo(this.aimPosition.x + 16, this.aimPosition.y - 16);
		this.dynamicGraphics.lineTo(this.aimPosition.x - 16, this.aimPosition.y + 16);
		this.dynamicGraphics.strokePath();
	}

	private rollEnemyOutcome(): EnemyOutcome {
		const roll = Phaser.Math.Between(1, 100);

		if (roll <= 6) {
			return "perfect";
		}

		if (roll <= 22) {
			return "miss";
		}

		if (roll <= 84) {
			return "one-point";
		}

		return "lance-strike";
	}

	private resolveRun() {
		if (this.runPhase !== "charge") {
			return;
		}

		this.runPhase = "resolve";
		this.updateEnemyPose(this.time.now);

		const playerHit = this.getPlayerHit();
		const enemyOutcome = this.currentEnemyOutcome;
		this.markerFeedback = playerHit;

		if (playerHit === "horse") {
			this.finishMatch(
				"lost",
				`Pass ${this.runNumber}: horse hit. You forfeit the match immediately.`,
			);
			return;
		}

		if (enemyOutcome === "lance-strike") {
			if (playerHit === "perfect" || playerHit === "two-point") {
				this.playerScore += 1;
				this.enemyScore += 1;
				this.completeRun(
					`Pass ${this.runNumber}: lance strike. Both knights take 1 point. Score ${this.playerScore}-${this.enemyScore}.`,
				);
				return;
			}

			if (playerHit === "one-point") {
				this.enemyScore += 1;
				this.completeRun(
					`Pass ${this.runNumber}: glancing lance strike. Rival takes 1 point. Score ${this.playerScore}-${this.enemyScore}.`,
				);
				return;
			}

			this.enemyScore += 1;
			this.completeRun(
				`Pass ${this.runNumber}: you missed, rival lands the lance strike for 1 point. Score ${this.playerScore}-${this.enemyScore}.`,
			);
			return;
		}

		if (playerHit === "perfect") {
			this.finishMatch("won", `Pass ${this.runNumber}: perfect hit. You win instantly.`);
			return;
		}

		if (enemyOutcome === "perfect") {
			this.finishMatch("lost", `Pass ${this.runNumber}: the rival lands a perfect strike and wins instantly.`);
			return;
		}

		if (playerHit === "two-point") {
			this.playerScore += 2;
		} else if (playerHit === "one-point") {
			this.playerScore += 1;
		}

		if (enemyOutcome === "one-point") {
			this.enemyScore += 1;
		}

		const playerSummary = this.describePlayerHit(playerHit);
		const enemySummary = this.describeEnemyOutcome(enemyOutcome);
		this.completeRun(`Pass ${this.runNumber}: ${playerSummary} ${enemySummary} Score ${this.playerScore}-${this.enemyScore}.`);
	}

	private completeRun(message: string) {
		if (this.runNumber >= TOTAL_RUNS) {
			if (this.playerScore > this.enemyScore) {
				this.finishMatch("won", `${message} You win the match on points.`);
				return;
			}

			if (this.playerScore === this.enemyScore) {
				this.finishMatch("lost", `${message} The judges break the deadlock in the rival's favor.`);
				return;
			}

			this.finishMatch("lost", `${message} The rival wins on points.`);
			return;
		}

		this.emitState(`${message} Next pass loading.`);
		this.nextRunTimer = this.time.delayedCall(1300, () => {
			this.startNextRun();
		});
	}

	private getPlayerHit(): PlayerHit {
		const enemyX = this.enemyKnight?.x ?? ENEMY_END_X;
		const enemyY = this.enemyKnight?.y ?? ENEMY_END_Y;
		const enemyScale = this.enemyKnight?.scaleX ?? ENEMY_END_SCALE;
		const targets = getTargetLayout(enemyX, enemyY, enemyScale);

		if (
			pointInEllipse(
				this.aimPosition.x,
				this.aimPosition.y,
				targets.horseX,
				targets.horseY,
				targets.horseRadiusX,
				targets.horseRadiusY,
			)
		) {
			return "horse";
		}

		if (
			Phaser.Math.Distance.Between(this.aimPosition.x, this.aimPosition.y, targets.headX, targets.headY) <=
			targets.headRadius
		) {
			return "perfect";
		}

		if (
			pointInRect(
				this.aimPosition.x,
				this.aimPosition.y,
				targets.bodyX,
				targets.bodyInnerRectY,
				targets.bodyInnerWidth,
				targets.bodyInnerHeight,
			)
		) {
			return "two-point";
		}

		if (
			pointInEllipse(
				this.aimPosition.x,
				this.aimPosition.y,
				targets.bodyX,
				targets.bodyY,
				targets.bodyOuterRadiusX,
				targets.bodyOuterRadiusY,
			)
		) {
			return "one-point";
		}

		return "miss";
	}

	private describePlayerHit(hit: PlayerHit) {
		if (hit === "perfect") {
			return "Perfect hit.";
		}

		if (hit === "two-point") {
			return "2-point hit.";
		}

		if (hit === "one-point") {
			return "1-point hit.";
		}

		return "Miss.";
	}

	private describeEnemyOutcome(outcome: EnemyOutcome) {
		if (outcome === "perfect") {
			return "Rival perfect hit.";
		}

		if (outcome === "one-point") {
			return "Rival scores 1.";
		}

		return "Rival scores 0.";
	}

	private getProgressMessage() {
		return `Pass ${this.runNumber}/${TOTAL_RUNS}. Hold steady. Score ${this.playerScore}-${this.enemyScore}.`;
	}

	private emitState(message: string) {
		gameEventBus.emit(GAME_EVENTS.GAME_STATE, {
			sceneKey: "Minigame 5",
			status: this.gameStatus,
			remainingChunks: Math.max(0, TOTAL_RUNS - this.runNumber),
			totalChunks: TOTAL_RUNS,
			elapsedMs: this.matchElapsedMs,
			currentRound: Math.min(this.runNumber, TOTAL_RUNS),
			playerScore: this.playerScore,
			enemyScore: this.enemyScore,
			message,
		});
	}

	private finishMatch(status: "won" | "lost", message: string) {
		this.gameStatus = status;
		this.runPhase = "complete";
		this.inputVector.set(0, 0);
		this.aimVelocity.set(0, 0);
		this.nextRunTimer?.destroy();
		this.emitState(message);
	}
	}