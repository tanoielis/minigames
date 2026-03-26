import * as Phaser from "phaser";
import { GAME_EVENTS, gameEventBus } from "@/game/event-bus";

type Card = {
	rank: string;
	suit: string;
};

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function randomInt(max: number) {
	return Math.floor(Math.random() * max);
}

function shuffle<T>(items: T[]) {
	for (let i = items.length - 1; i > 0; i -= 1) {
		const j = randomInt(i + 1);
		[items[i], items[j]] = [items[j], items[i]];
	}
	return items;
}

function valueOfCard(card: Card) {
	if (card.rank === "A") {
		return 11;
	}
	if (["J", "Q", "K"].includes(card.rank)) {
		return 10;
	}
	return Number(card.rank);
}

function handValue(cards: Card[]) {
	let total = 0;
	let aces = 0;
	for (const card of cards) {
		if (card.rank === "A") {
			aces += 1;
		}
		total += valueOfCard(card);
	}
	while (total > 21 && aces > 0) {
		total -= 10;
		aces -= 1;
	}
	return total;
}

function renderHandText(cards: Card[]) {
	return cards.map((card) => `${card.rank}${card.suit}`).join(" ");
}

export class Minigame9Scene extends Phaser.Scene {
	private deck: Card[] = [];
	private playerCards: Card[] = [];
	private dealerCards: Card[] = [];
	private gameStatus: "booting" | "playing" | "won" | "lost" = "booting";
	private message = "Booting Blackjack...";
	private playerText?: Phaser.GameObjects.Text;
	private dealerText?: Phaser.GameObjects.Text;
	private statusText?: Phaser.GameObjects.Text;
	private promptText?: Phaser.GameObjects.Text;
	private cleanupListeners: Array<() => void> = [];

	constructor() {
		super("minigame9");
	}

	create() {
		this.cameras.main.setBackgroundColor("#1a1f2a");
		this.setupEventBridge();
		this.buildBoard();
		this.startRound();
		this.emitGameState("Blackjack ready. Hit to draw a card or Stand to let dealer play.");
		gameEventBus.emit(GAME_EVENTS.SCENE_READY, { sceneKey: "Minigame 9" });
	}

	private emitGameState(message: string) {
		this.message = message;
		this.statusText?.setText(`Status: ${this.gameStatus.toUpperCase()}`);
		this.promptText?.setText(message);
		const playerValue = handValue(this.playerCards);
		const dealerFace = this.gameStatus === "playing" ? `${this.dealerCards[0].rank}${this.dealerCards[0].suit} ?` : renderHandText(this.dealerCards);
		this.playerText?.setText(`Player (${playerValue}): ${renderHandText(this.playerCards)}`);
		const dealerValue = this.gameStatus === "playing" ? "?" : String(handValue(this.dealerCards));
		this.dealerText?.setText(`Dealer (${dealerValue}): ${dealerFace}`);

		gameEventBus.emit(GAME_EVENTS.GAME_STATE, {
			sceneKey: "Minigame 9",
			status: this.gameStatus,
			remainingChunks: 0,
			totalChunks: 0,
			elapsedMs: 0,
			message,
		});
	}

	private createDeck() {
		const cards: Card[] = [];
		for (const suit of SUITS) {
			for (const rank of RANKS) {
				cards.push({ rank, suit });
			}
		}
		shuffle(cards);
		return cards;
	}

	private drawCard() {
		if (this.deck.length === 0) {
			this.deck = this.createDeck();
		}
		return this.deck.pop() as Card;
	}

	private startRound() {
		this.deck = this.createDeck();
		this.playerCards = [this.drawCard(), this.drawCard()];
		this.dealerCards = [this.drawCard(), this.drawCard()];
		this.gameStatus = "playing";
		this.emitGameState("New hand dealt. Hit or Stand.");
	}

	private closeRound(result: "won" | "lost", message: string) {
		this.gameStatus = result;
		this.emitGameState(message);
	}

	private evaluateOutcome() {
		const playerTotal = handValue(this.playerCards);
		if (playerTotal > 21) {
			this.closeRound("lost", "Bust! Dealer wins. Tap Deal to play again.");
			return;
		}

		let dealerTotal = handValue(this.dealerCards);
		while (dealerTotal < 17) {
			this.dealerCards.push(this.drawCard());
			dealerTotal = handValue(this.dealerCards);
		}

		if (dealerTotal > 21) {
			this.closeRound("won", "Dealer busts! You win. Tap Deal for another hand.");
			return;
		}

		if (playerTotal > dealerTotal) {
			this.closeRound("won", "You win! Tap Deal to play again.");
			return;
		}

		if (playerTotal === dealerTotal) {
			this.closeRound("lost", "Push counts as loss here. Tap Deal to retry.");
			return;
		}

		this.closeRound("lost", "Dealer wins. Tap Deal for the next hand.");
	}

	private handleGameAction(action: "deal" | "hit" | "stand") {
		if (action === "deal") {
			this.startRound();
			return;
		}

		if (this.gameStatus !== "playing") {
			this.emitGameState("Press Deal to start a new hand.");
			return;
		}

		if (action === "hit") {
			this.playerCards.push(this.drawCard());
			if (handValue(this.playerCards) > 21) {
				this.evaluateOutcome();
				return;
			}
			this.emitGameState("Hit taken. Decide next move.");
			return;
		}

		if (action === "stand") {
			this.evaluateOutcome();
			return;
		}
	}

	private setupEventBridge() {
		this.cleanupListeners.forEach((cleanup) => cleanup());
		this.cleanupListeners = [
			gameEventBus.on(GAME_EVENTS.MINIGAME9_ACTION, ({ action }) => {
				this.handleGameAction(action);
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

	private buildBoard() {
		this.add.text(16, 16, "Blackjack", { fontFamily: "Arial", fontSize: "28px", color: "#ffffff" });
		this.dealerText = this.add.text(16, 64, "Dealer: ", { fontFamily: "Arial", fontSize: "20px", color: "#ffffff" });
		this.playerText = this.add.text(16, 108, "Player: ", { fontFamily: "Arial", fontSize: "20px", color: "#ffffff" });
		this.statusText = this.add.text(16, 156, "Status: ", { fontFamily: "Arial", fontSize: "18px", color: "#f0f5ff" });
		this.promptText = this.add.text(16, 186, "", { fontFamily: "Arial", fontSize: "18px", color: "#c2d8ff", wordWrap: { width: 920 } });
	}
}
