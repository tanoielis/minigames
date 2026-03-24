import * as Phaser from "phaser";
import { GAME_EVENTS, gameEventBus } from "@/game/event-bus";

type BoxingAction = "jab" | "hook" | "block";
type AttackKind = "jab" | "hook";
type AttackSide = "wide-left" | "close-left" | "close-right" | "wide-right";
type MatchPhase = "out-range" | "in-range" | "countdown" | "between-rounds" | "complete";
type BoxerKey = "player" | "enemy";

type BoxerState = {
	hp: number;
	stamina: number;
	cooldownMs: number;
	roundDamage: number;
	roundKnockdowns: number;
};

type PendingEnemyAttack = {
	kind: AttackKind;
	side: AttackSide;
	telegraphAt: number;
	executeAt: number;
	resolveAt: number;
	resolved: boolean;
};

type DownCount = {
	target: BoxerKey;
	startedAt: number;
	durationMs: number;
	finalCount: number;
	knockout: boolean;
	attacker: BoxerKey;
	message: string;
};

type RecentAction = {
	kind: BoxingAction | AttackKind;
	at: number;
};

const ROUND_DURATION_MS = 15000;
const TOTAL_ROUNDS = 3;
const MAX_HP = 10;
const MAX_STAMINA = 10;
const COOLDOWN_MS = 1500;
const STAMINA_REGEN_PER_SEC = 1;
const BETWEEN_ROUND_RECOVERY = 2;
const RANGE_WINDOW_MS = 2000;
const INTRO_NEARNESS = 0.5;
const IN_RANGE_NEARNESS = 1;
const PUNCH_WINDOW_MS = 300;
const BLOCK_WINDOW_BUFFER_MS = 90;
const JAB_DODGE_CHANCE = 50;

function clamp(value: number, min: number, max: number) {
	return Phaser.Math.Clamp(value, min, max);
}

export class Minigame6Scene extends Phaser.Scene {
	private cleanupListeners: Array<() => void> = [];
	private backgroundGraphics?: Phaser.GameObjects.Graphics;
	private ringGraphics?: Phaser.GameObjects.Graphics;
	private overlayGraphics?: Phaser.GameObjects.Graphics;
	private opponentSprite?: Phaser.GameObjects.Image;
	private opponentShadow?: Phaser.GameObjects.Ellipse;
	private countText?: Phaser.GameObjects.Text;
	private topLabel?: Phaser.GameObjects.Text;
	private phase: MatchPhase = "between-rounds";
	private phaseElapsedMs = 0;
	private phaseDurationMs = 0;
	private matchElapsedMs = 0;
	private roundElapsedMs = 0;
	private currentRound = 0;
	private playerCards = 0;
	private enemyCards = 0;
	private gameStatus: "booting" | "playing" | "won" | "lost" = "booting";
	private opponentIdleTexture = "light-boxer";
	private opponentHitTexture = "light-boxer-hit";
	private player: BoxerState = this.createBoxerState();
	private enemy: BoxerState = this.createBoxerState();
	private pendingEnemyAttack?: PendingEnemyAttack;
	private recentPlayerAction?: RecentAction;
	private recentEnemyAction?: RecentAction;
	private rockWindowEndsAt = 0;
	private nextEnemyActionAt = 0;
	private downCount?: DownCount;
	private betweenRoundTimer?: Phaser.Time.TimerEvent;
	private hitResetTimer?: Phaser.Time.TimerEvent;
	private controlsSignature = "";
	private message = "Booting Phaser bridge...";
	private redFlashMs = 0;

	constructor() {
		super("minigame6");
	}

	create() {
		this.cameras.main.setBackgroundColor("#090511");
		this.setupEventBridge();
		this.buildBackdrop();
		this.createOpponent();
		this.startMatch();
		gameEventBus.emit(GAME_EVENTS.SCENE_READY, { sceneKey: "Minigame 6" });
	}

	update(time: number, delta: number) {
		if (!this.overlayGraphics) {
			return;
		}

		if (this.gameStatus === "playing") {
			this.matchElapsedMs += delta;
		}
		this.redFlashMs = Math.max(0, this.redFlashMs - delta);

		this.player.cooldownMs = Math.max(0, this.player.cooldownMs - delta);
		this.enemy.cooldownMs = Math.max(0, this.enemy.cooldownMs - delta);
		this.player.stamina = clamp(this.player.stamina + (delta / 1000) * STAMINA_REGEN_PER_SEC, 0, MAX_STAMINA);
		this.enemy.stamina = clamp(this.enemy.stamina + (delta / 1000) * STAMINA_REGEN_PER_SEC, 0, MAX_STAMINA);

		this.updateOpponentPose(time);
		this.updateCountdown();
		this.updateEnemyActions();
		this.renderScene(time);
		this.emitControls();

		if (this.gameStatus !== "playing") {
			return;
		}

		if (this.phase !== "countdown" && this.phase !== "between-rounds") {
			this.roundElapsedMs += delta;
			this.phaseElapsedMs += delta;
		}

		if (this.currentRound > 0 && this.roundElapsedMs >= ROUND_DURATION_MS) {
			this.finishRound();
			return;
		}

		if (this.phase === "out-range" && this.phaseElapsedMs >= this.phaseDurationMs) {
			this.enterInRange();
		} else if (this.phase === "in-range" && this.phaseElapsedMs >= this.phaseDurationMs && !this.pendingEnemyAttack) {
			this.enterOutOfRange(false);
		}

		if ((this.matchElapsedMs % 120) < delta) {
			this.emitState(this.phase === "complete" ? this.message : "");
		}
	}

	private createBoxerState(): BoxerState {
		return {
			hp: MAX_HP,
			stamina: MAX_STAMINA,
			cooldownMs: 0,
			roundDamage: 0,
			roundKnockdowns: 0,
		};
	}

	private setupEventBridge() {
		this.cleanupListeners.forEach((cleanup) => cleanup());
		this.cleanupListeners = [
			gameEventBus.on(GAME_EVENTS.BOXING_ACTION, ({ action }) => {
				this.handlePlayerAction(action);
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

		this.backgroundGraphics = this.add.graphics().setDepth(0);
		this.ringGraphics = this.add.graphics().setDepth(1);
		this.overlayGraphics = this.add.graphics().setDepth(20);

		this.backgroundGraphics.fillGradientStyle(0x1f2347, 0x1f2347, 0x080b17, 0x080b17, 1);
		this.backgroundGraphics.fillRect(0, 0, width, height);
		this.backgroundGraphics.fillStyle(0x1f2a52, 0.55);
		this.backgroundGraphics.fillEllipse(190, 126, 280, 110);
		this.backgroundGraphics.fillEllipse(480, 104, 340, 120);
		this.backgroundGraphics.fillEllipse(780, 142, 290, 116);
		this.backgroundGraphics.fillStyle(0x14192d, 1);
		this.backgroundGraphics.fillRect(0, 170, width, height - 170);

		this.ringGraphics.fillStyle(0x1b2037, 1);
		this.ringGraphics.fillRect(88, 182, 784, 258);
		this.ringGraphics.fillStyle(0x243054, 1);
		this.ringGraphics.fillRect(116, 206, 728, 210);
		this.ringGraphics.lineStyle(8, 0xff375f, 0.9);
		this.ringGraphics.lineBetween(96, 236, 864, 236);
		this.ringGraphics.lineStyle(8, 0xf3f4f6, 0.9);
		this.ringGraphics.lineBetween(96, 286, 864, 286);
		this.ringGraphics.lineStyle(8, 0x56c2ff, 0.9);
		this.ringGraphics.lineBetween(96, 336, 864, 336);
		this.ringGraphics.fillStyle(0xe7ecff, 0.95);
		this.ringGraphics.fillRect(110, 190, 16, 240);
		this.ringGraphics.fillRect(834, 190, 16, 240);

		this.topLabel = this.add
			.text(width / 2, 44, "BOX-OFF!", {
				fontFamily: "Arial",
				fontSize: "30px",
				color: "#f7fbff",
			})
			.setOrigin(0.5)
			.setDepth(25);

		this.countText = this.add
			.text(width / 2, height / 2 + 6, "", {
				fontFamily: "Arial",
				fontSize: "92px",
				fontStyle: "bold",
				color: "#fff3db",
				stroke: "#05060a",
				strokeThickness: 8,
			})
			.setOrigin(0.5)
			.setDepth(30)
			.setVisible(false);
	}

	private createOpponent() {
		const opponentVariant = Phaser.Math.Between(0, 1) === 0 ? "light" : "dark";
		this.opponentIdleTexture = `${opponentVariant}-boxer`;
		this.opponentHitTexture = `${opponentVariant}-boxer-hit`;
		this.opponentSprite = this.add.image(640, 278, this.opponentIdleTexture).setDepth(10);
		this.opponentShadow = this.add.ellipse(640, 426, 130, 24, 0x000000, 0.22).setDepth(8);
	}

	private startMatch() {
		this.player = this.createBoxerState();
		this.enemy = this.createBoxerState();
		this.playerCards = 0;
		this.enemyCards = 0;
		this.currentRound = 0;
		this.matchElapsedMs = 0;
		this.gameStatus = "playing";
		this.message = "Bell rings. Work behind the jab and watch the telegraph.";
		this.startRound(1);
	}

	private startRound(roundNumber: number) {
		this.currentRound = roundNumber;
		this.roundElapsedMs = 0;
		this.phaseElapsedMs = 0;
		this.phaseDurationMs = RANGE_WINDOW_MS;
		this.phase = "out-range";
		this.pendingEnemyAttack = undefined;
		this.downCount = undefined;
		this.recentEnemyAction = undefined;
		this.recentPlayerAction = undefined;
		this.rockWindowEndsAt = 0;
		this.player.roundDamage = 0;
		this.enemy.roundDamage = 0;
		this.player.roundKnockdowns = 0;
		this.enemy.roundKnockdowns = 0;
		this.player.cooldownMs = 0;
		this.enemy.cooldownMs = 0;
		this.showOpponent(true);
		this.message = `Round ${roundNumber}. Opponent is still in the corner. Stay patient.`;
		this.emitState(this.message);
	}

	private enterOutOfRange(openingRound: boolean) {
		this.phase = "out-range";
		this.phaseElapsedMs = 0;
		this.phaseDurationMs = RANGE_WINDOW_MS;
		this.pendingEnemyAttack = undefined;
		this.nextEnemyActionAt = this.matchElapsedMs + (openingRound ? 2200 : 2600);
		this.message = openingRound
			? `Round ${this.currentRound}. Opponent is walking in from the corner.`
			: "Opponent backs out of range for a moment.";
	}

	private enterInRange() {
		this.phase = "in-range";
		this.phaseElapsedMs = 0;
		this.phaseDurationMs = Phaser.Math.Between(2600, 4200);
		this.nextEnemyActionAt = this.matchElapsedMs + Phaser.Math.Between(500, 1000);
		this.message = `Round ${this.currentRound}. Opponent is in range.`;
	}

	private handlePlayerAction(action: BoxingAction) {
		if (this.gameStatus !== "playing" || this.phase === "between-rounds" || this.phase === "countdown" || this.phase === "complete") {
			return;
		}

		const staminaCost = action === "hook" ? 2 : 1;

		if (this.player.cooldownMs > 0 || this.player.stamina < staminaCost) {
			return;
		}

		const now = this.matchElapsedMs;
		this.player.stamina = clamp(this.player.stamina - staminaCost, 0, MAX_STAMINA);
		this.player.cooldownMs = COOLDOWN_MS;
		this.recentPlayerAction = { kind: action, at: now };

		if (this.phase === "out-range") {
			if (action === "block") {
				this.message = "You shell up while the opponent hangs back.";
				return;
			}

			this.handleOutOfRangePunch(action);
			return;
		}

		if (action === "block") {
			this.handlePlayerBlock(now);
			return;
		}

		if (action === "jab") {
			this.handlePlayerJab(now);
			return;
		}

		this.handlePlayerHook(now);
	}

	private handleOutOfRangePunch(action: AttackKind) {
		if (Phaser.Math.Between(0, 99) >= 55) {
			this.message = `Your ${action} falls short outside range.`;
			return;
		}

		const counterKind: AttackKind = Phaser.Math.Between(0, 99) < 45 ? "hook" : "jab";
		const damage = counterKind === "hook" ? 2 : 1;
		this.applyHit("enemy", "player", damage, counterKind, `You get countered stepping in with that ${action}.`);

		if (counterKind === "hook" && Phaser.Math.Between(0, 99) < 30) {
			this.triggerKnockdown("player", "enemy", false, "Counter hook scores a knockdown.");
		}
	}

	private handlePlayerBlock(now: number) {
		if (!this.pendingEnemyAttack || this.pendingEnemyAttack.resolved || now > this.pendingEnemyAttack.resolveAt) {
			this.message = "Guard high.";
			return;
		}

		if (this.pendingEnemyAttack.kind === "jab") {
			this.resolvePendingEnemyAttack(now);
			if (Phaser.Math.Between(0, 99) < 50) {
				this.rockWindowEndsAt = now + PUNCH_WINDOW_MS;
				this.message = "Perfect block. Opponent is rocked.";
			} else {
				this.message = "You block the jab clean.";
			}
			return;
		}

		this.resolvePendingEnemyAttack(now);
		this.message = "You smother the hook on the guard.";
	}

	private handlePlayerJab(now: number) {
		if (this.pendingEnemyAttack && !this.pendingEnemyAttack.resolved) {
			if (this.pendingEnemyAttack.kind === "jab") {
				this.resolvePendingEnemyAttack(now);
				this.player.cooldownMs = 0;
				this.message = "Both jabs collide and cancel out.";
				return;
			}

			const timing = this.pendingEnemyAttack.executeAt - now;

			if (timing >= 0 && timing <= PUNCH_WINDOW_MS) {
				this.resolvePendingEnemyAttack(now);
				this.applyHit("player", "enemy", 1, "jab", "Your jab beats the hook to the target.");
				return;
			}
		}

		if (Phaser.Math.Between(0, 99) < JAB_DODGE_CHANCE) {
			this.message = "Opponent slips the jab.";
			return;
		}

		this.applyHit("player", "enemy", 1, "jab", "Jab lands." );
	}

	private handlePlayerHook(now: number) {
		if (this.rockWindowEndsAt > now) {
			this.rockWindowEndsAt = 0;
			if (Phaser.Math.Between(0, 99) < 80) {
				this.triggerKnockdown("enemy", "player", false, "You cash in the rock with a knockdown hook.");
				return;
			}

			this.applyHit("player", "enemy", 2, "hook", "Hook follows the rock, but the knockdown doesn't come.");
			return;
		}

		this.applyHit("player", "enemy", 2, "hook", "Hook lands clean." );
	}

	private updateEnemyActions() {
		if (this.phase !== "in-range" || this.downCount) {
			return;
		}

		if (this.pendingEnemyAttack?.resolved) {
			this.pendingEnemyAttack = undefined;
		}

		if (!this.pendingEnemyAttack && this.matchElapsedMs >= this.nextEnemyActionAt && this.enemy.cooldownMs <= 0) {
			this.scheduleEnemyAttack();
		}

		if (this.pendingEnemyAttack && !this.pendingEnemyAttack.resolved && this.matchElapsedMs >= this.pendingEnemyAttack.resolveAt) {
			this.executeEnemyAttack();
		}
	}

	private scheduleEnemyAttack() {
		if (this.enemy.stamina < 1) {
			this.nextEnemyActionAt = this.matchElapsedMs + Phaser.Math.Between(700, 1300);
			return;
		}

		const kind: AttackKind = this.enemy.stamina >= 2 && Phaser.Math.Between(0, 99) < 38 ? "hook" : "jab";
		const side = this.pickAttackSide(kind);
		const telegraphLead = 320;

		this.pendingEnemyAttack = {
			kind,
			side,
			telegraphAt: this.matchElapsedMs,
			executeAt: this.matchElapsedMs + telegraphLead,
			resolveAt: this.matchElapsedMs + telegraphLead + BLOCK_WINDOW_BUFFER_MS,
			resolved: false,
		};
		this.message = kind === "hook" ? "Watch the wide shot telegraph." : "Quick shot coming.";
	}

	private resolvePendingEnemyAttack(now: number) {
		if (!this.pendingEnemyAttack) {
			return;
		}

		this.pendingEnemyAttack.resolved = true;
		this.pendingEnemyAttack = undefined;
		this.nextEnemyActionAt = now + Phaser.Math.Between(700, 1200);
	}

	private executeEnemyAttack() {
		if (!this.pendingEnemyAttack || this.pendingEnemyAttack.resolved) {
			this.pendingEnemyAttack = undefined;
			return;
		}

		const attack = this.pendingEnemyAttack;
		const now = this.matchElapsedMs;
		const recentPlayer = this.recentPlayerAction && now - this.recentPlayerAction.at <= PUNCH_WINDOW_MS ? this.recentPlayerAction : undefined;

		this.enemy.cooldownMs = COOLDOWN_MS;
		this.enemy.stamina = clamp(this.enemy.stamina - (attack.kind === "hook" ? 2 : 1), 0, MAX_STAMINA);
		this.recentEnemyAction = { kind: attack.kind, at: now };
		this.nextEnemyActionAt = now + Phaser.Math.Between(1300, 2200);

		if (recentPlayer?.kind === "jab") {
			if (attack.kind === "jab") {
				this.message = "Both jabs collide and cancel out.";
				this.pendingEnemyAttack = undefined;
				return;
			}

			this.applyHit("player", "enemy", 1, "jab", "Your jab snuffs out the hook on the way in.");
			this.pendingEnemyAttack = undefined;
			return;
		}

		if (attack.kind === "jab") {
			this.applyHit("enemy", "player", 1, "jab", "Opponent's jab scores.");
			this.pendingEnemyAttack = undefined;
			return;
		}

		this.applyHit("enemy", "player", 2, "hook", "Opponent's hook crashes through.");
		this.pendingEnemyAttack = undefined;
	}

	private pickAttackSide(kind: AttackKind): AttackSide {
		if (kind === "hook") {
			return Phaser.Math.Between(0, 1) === 0 ? "wide-left" : "wide-right";
		}

		return Phaser.Math.Between(0, 1) === 0 ? "close-left" : "close-right";
	}

	private applyHit(attacker: BoxerKey, target: BoxerKey, damage: number, kind: AttackKind, message: string) {
		const source = attacker === "player" ? this.player : this.enemy;
		const victim = target === "player" ? this.player : this.enemy;
		source.roundDamage += damage;
		victim.hp = clamp(victim.hp - damage, 0, MAX_HP);
		this.message = message;

		if (target === "enemy") {
			this.flashOpponentHit();
		} else {
			this.redFlashMs = 420;
			this.cameras.main.shake(140, 0.0045);
			this.cameras.main.flash(120, 255, 32, 64, false);
		}

		if (kind === "hook" && victim.stamina <= 0) {
			this.triggerKnockdown(target, attacker, false, target === "enemy" ? "Hook lands on an empty tank. Knockdown." : "You get caught without stamina. Knockdown.");
			return;
		}

		if (victim.hp <= 0) {
			this.triggerKnockdown(target, attacker, true, target === "enemy" ? "Opponent is dropped and may not beat the count." : "You are dropped and in real trouble.");
		}
	}

	private flashOpponentHit() {
		if (!this.opponentSprite) {
			return;
		}

		this.hitResetTimer?.destroy();
		this.opponentSprite.setTexture(this.opponentHitTexture);
		this.hitResetTimer = this.time.delayedCall(180, () => {
			this.opponentSprite?.setTexture(this.opponentIdleTexture);
		});
	}

	private triggerKnockdown(target: BoxerKey, attacker: BoxerKey, forcedKnockout: boolean, message: string) {
		if (this.downCount) {
			return;
		}

		const victim = target === "player" ? this.player : this.enemy;
		const source = attacker === "player" ? this.player : this.enemy;
		source.roundKnockdowns += 1;

		const healthPct = victim.hp / MAX_HP;
		const knockout = forcedKnockout || (victim.hp < 5 && Phaser.Math.Between(0, 99) < 50);
		const finalCount = knockout ? 10 : clamp(Math.round(3 + (1 - healthPct) * 5), 2, 8);
		const durationMs = finalCount * 1000;

		this.downCount = {
			target,
			startedAt: this.matchElapsedMs,
			durationMs,
			finalCount,
			knockout,
			attacker,
			message,
		};

		this.pendingEnemyAttack = undefined;
		this.rockWindowEndsAt = 0;
		this.phase = "countdown";
		this.phaseElapsedMs = 0;
		this.phaseDurationMs = durationMs;
		this.message = message;
		this.showOpponent(target !== "enemy");
		this.emitState(this.message);
	}

	private updateCountdown() {
		if (!this.downCount || !this.countText) {
			if (this.countText) {
				this.countText.setVisible(false);
			}
			return;
		}

		const elapsed = this.matchElapsedMs - this.downCount.startedAt;
		const shownCount = clamp(Math.ceil(elapsed / 1000), 1, this.downCount.finalCount);
		this.countText.setVisible(true);
		this.countText.setText(String(shownCount));

		if (elapsed < this.downCount.durationMs) {
			return;
		}

		const target = this.downCount.target === "player" ? this.player : this.enemy;
		const attackerWon = this.downCount.attacker === "player";

		if (this.downCount.knockout) {
			this.finishMatch(attackerWon ? "won" : "lost", attackerWon ? "Knockout win." : "You are counted out.");
			return;
		}

		target.hp = Math.max(1, target.hp);
		target.stamina = Math.max(target.stamina, 2);
		this.downCount = undefined;
		this.countText.setVisible(false);
		this.showOpponent(true);
		this.enterOutOfRange(false);
		this.emitState("Back on their feet.");
	}

	private finishRound() {
		if (this.phase === "between-rounds" || this.phase === "complete") {
			return;
		}

		const roundSummary = this.scoreRound();
		this.player.hp = clamp(this.player.hp + BETWEEN_ROUND_RECOVERY, 0, MAX_HP);
		this.enemy.hp = clamp(this.enemy.hp + BETWEEN_ROUND_RECOVERY, 0, MAX_HP);
		this.player.stamina = clamp(this.player.stamina + BETWEEN_ROUND_RECOVERY, 0, MAX_STAMINA);
		this.enemy.stamina = clamp(this.enemy.stamina + BETWEEN_ROUND_RECOVERY, 0, MAX_STAMINA);
		this.pendingEnemyAttack = undefined;
		this.phase = "between-rounds";
		this.phaseElapsedMs = 0;
		this.phaseDurationMs = 2200;
		this.message = roundSummary;
		this.emitState(roundSummary);

		if (this.currentRound >= TOTAL_ROUNDS) {
			if (this.playerCards > this.enemyCards) {
				this.finishMatch("won", `${roundSummary} You win on the cards.`);
				return;
			}

			if (this.playerCards === this.enemyCards) {
				this.finishMatch("lost", `${roundSummary} Even cards, but the judges lean to the house fighter.`);
				return;
			}

			this.finishMatch("lost", `${roundSummary} Opponent wins on the cards.`);
			return;
		}

		this.betweenRoundTimer?.destroy();
		this.betweenRoundTimer = this.time.delayedCall(2200, () => {
			this.startRound(this.currentRound + 1);
		});
	}

	private scoreRound() {
		const damageDiff = Math.abs(this.player.roundDamage - this.enemy.roundDamage);

		if (this.player.roundKnockdowns > this.enemy.roundKnockdowns) {
			this.playerCards += 10;
			this.enemyCards += 8;
			return `Round ${this.currentRound}: 10-8 to you on knockdowns.`;
		}

		if (this.enemy.roundKnockdowns > this.player.roundKnockdowns) {
			this.playerCards += 8;
			this.enemyCards += 10;
			return `Round ${this.currentRound}: 10-8 against you on knockdowns.`;
		}

		if (this.player.roundDamage === this.enemy.roundDamage) {
			this.playerCards += 9;
			this.enemyCards += 9;
			return `Round ${this.currentRound}: 9-9 even round.`;
		}

		const playerWon = this.player.roundDamage > this.enemy.roundDamage;

		if (damageDiff <= 3) {
			this.playerCards += playerWon ? 10 : 9;
			this.enemyCards += playerWon ? 9 : 10;
			return `Round ${this.currentRound}: ${playerWon ? "10-9 to you" : "10-9 against you"}.`;
		}

		this.playerCards += playerWon ? 10 : 8;
		this.enemyCards += playerWon ? 8 : 10;
		return `Round ${this.currentRound}: ${playerWon ? "10-8 to you" : "10-8 against you"}.`;
	}

	private updateOpponentPose(time: number) {
		if (!this.opponentSprite || !this.opponentShadow) {
			return;
		}

		const nearness = this.getOpponentNearness();
		const bob = Math.sin(time * 0.014 + nearness * 3.2) * 6;
		const x = Phaser.Math.Linear(656, 584, nearness);
		const y = Phaser.Math.Linear(304, 418, nearness) + bob;
		const scale = Phaser.Math.Linear(0.33, 0.68, nearness);

		this.opponentSprite.setPosition(x, y).setScale(scale);
		this.opponentShadow.setPosition(x, Phaser.Math.Linear(468, 498, nearness));
		this.opponentShadow.scaleX = Phaser.Math.Linear(0.68, 1.06, nearness);
		this.opponentShadow.scaleY = Phaser.Math.Linear(0.8, 1.02, nearness);
		this.opponentShadow.alpha = Phaser.Math.Linear(0.12, 0.28, nearness);
	}

	private getOpponentNearness() {
		if (this.phase === "complete" || this.phase === "between-rounds") {
			return 0.34;
		}

		if (this.phase === "countdown") {
			return IN_RANGE_NEARNESS;
		}

		if (this.phase === "in-range") {
			return Phaser.Math.Linear(INTRO_NEARNESS, IN_RANGE_NEARNESS, clamp(this.phaseElapsedMs / 360, 0, 1));
		}

		const t = clamp(this.phaseElapsedMs / this.phaseDurationMs, 0, 1);
		return this.currentRound === 1 && this.roundElapsedMs < RANGE_WINDOW_MS
			? Phaser.Math.Linear(0, INTRO_NEARNESS, t)
			: Phaser.Math.Linear(IN_RANGE_NEARNESS, INTRO_NEARNESS, clamp(t / 0.2, 0, 1));
	}

	private renderScene(time: number) {
		if (!this.overlayGraphics) {
			return;
		}

		this.overlayGraphics.clear();
		this.overlayGraphics.fillStyle(0xf7f0dd, 0.14);
		this.overlayGraphics.fillEllipse(244, 468, 180, 48);
		this.overlayGraphics.fillStyle(0x0b1220, 0.85);
		this.overlayGraphics.fillRect(0, 470, this.scale.width, 70);
		this.overlayGraphics.fillStyle(0xe7ecff, 0.08);
		this.overlayGraphics.fillRoundedRect(96, 194, 754, 236, 20);

		const gloveBob = Math.sin(time * 0.018) * 6;
		this.overlayGraphics.fillStyle(0xe11d48, 0.92);
		this.overlayGraphics.fillCircle(278, 462 + gloveBob, 36);
		this.overlayGraphics.fillCircle(390, 454 - gloveBob * 0.6, 42);
		this.overlayGraphics.fillStyle(0xffffff, 0.14);
		this.overlayGraphics.fillCircle(266, 448 + gloveBob, 12);
		this.overlayGraphics.fillCircle(378, 438 - gloveBob * 0.6, 13);

		if (this.phase === "in-range" && this.pendingEnemyAttack && !this.pendingEnemyAttack.resolved && this.matchElapsedMs <= this.pendingEnemyAttack.resolveAt) {
			this.renderTelegraphIndicator(this.pendingEnemyAttack.kind, time);
		}

		if (this.phase === "countdown" && this.downCount?.target === "player") {
			this.overlayGraphics.fillStyle(0x09040b, 0.4);
			this.overlayGraphics.fillRect(0, 0, this.scale.width, this.scale.height);
		}

		if (this.redFlashMs > 0) {
			this.overlayGraphics.fillStyle(0xff2146, Math.min(0.62, (this.redFlashMs / 420) * 0.62));
			this.overlayGraphics.fillRect(0, 0, this.scale.width, this.scale.height);
		}
	}

	private renderTelegraphIndicator(kind: AttackKind, time: number) {
		if (!this.overlayGraphics || !this.opponentSprite) {
			return;
		}

		const scale = this.opponentSprite.scaleX;
		const baseY = this.opponentSprite.y - 108 * scale;
		const pulse = 0.72 + (Math.sin(time * 0.022) + 1) * 0.14;
		const color = kind === "hook" ? 0xff8a1e : 0xffdd57;

		this.overlayGraphics.fillStyle(color, 0.22 * pulse);
		this.overlayGraphics.fillCircle(this.opponentSprite.x, baseY, 34 * pulse);
		this.overlayGraphics.fillStyle(color, 0.96);
		this.overlayGraphics.fillCircle(this.opponentSprite.x, baseY, 14);
	}

	private showOpponent(visible: boolean) {
		this.opponentSprite?.setVisible(visible);
		this.opponentShadow?.setVisible(visible);
	}

	private emitControls() {
		const actionable = this.gameStatus === "playing" && this.phase !== "countdown" && this.phase !== "between-rounds" && this.phase !== "complete";
		const state = {
			jabDisabled: !actionable || this.player.cooldownMs > 0 || this.player.stamina < 1,
			hookDisabled: !actionable || this.player.cooldownMs > 0 || this.player.stamina < 2,
			blockDisabled: !actionable || this.player.cooldownMs > 0 || this.player.stamina < 1,
		};
		const signature = JSON.stringify(state);

		if (signature === this.controlsSignature) {
			return;
		}

		this.controlsSignature = signature;
		gameEventBus.emit(GAME_EVENTS.MINIGAME6_CONTROLS, state);
	}

	private emitState(message: string) {
		gameEventBus.emit(GAME_EVENTS.GAME_STATE, {
			sceneKey: "Minigame 6",
			status: this.gameStatus,
			remainingChunks: Math.max(0, TOTAL_ROUNDS - this.currentRound),
			totalChunks: TOTAL_ROUNDS,
			elapsedMs: this.matchElapsedMs,
			roundTimeMs: Math.max(0, ROUND_DURATION_MS - this.roundElapsedMs),
			currentRound: this.currentRound,
			playerScore: this.playerCards,
			enemyScore: this.enemyCards,
			message,
		});
	}

	private finishMatch(status: "won" | "lost", message: string) {
		this.gameStatus = status;
		this.phase = "complete";
		this.pendingEnemyAttack = undefined;
		this.downCount = undefined;
		this.countText?.setVisible(false);
		this.message = message;
		this.emitState(message);
		this.emitControls();
	}
}