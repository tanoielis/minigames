import * as Phaser from "phaser";
import { GAME_EVENTS, gameEventBus } from "@/game/event-bus";

type MilkOption = "regular" | "oat" | "none";
type CupSize = "small" | "large";
type ToppingOption = "chocolate" | "cinnamon" | "none";
type HeadId = "left" | "right";

type Order = {
	id: number;
	cupSize: CupSize;
	milk: MilkOption;
	topping: ToppingOption;
	ageMs: number;
};

type Drink = {
	id: number;
	cupSize: CupSize;
	milk: MilkOption;
	topping: ToppingOption;
};

type HeadState = {
	id: HeadId;
	status: "empty" | "brewing" | "ready";
	cupSize: CupSize | null;
	progressMs: number;
};

type BenchSlot = {
	id: number;
	drink: Drink | null;
};

type JugState = {
	status: "idle" | "steaming" | "ready";
	milk: Extract<MilkOption, "regular" | "oat"> | null;
	progressMs: number;
};

type OrderVisual = {
	container: Phaser.GameObjects.Container;
	background: Phaser.GameObjects.Rectangle;
	timerBar: Phaser.GameObjects.Rectangle;
	warning: Phaser.GameObjects.Rectangle;
	serveLabel: Phaser.GameObjects.Text;
};

type BenchVisual = {
	background: Phaser.GameObjects.Rectangle;
	cup: Phaser.GameObjects.Image;
	milk: Phaser.GameObjects.Image;
	topping: Phaser.GameObjects.Image;
	label: Phaser.GameObjects.Text;
};

type HeadVisual = {
	base: Phaser.GameObjects.Rectangle;
	cup: Phaser.GameObjects.Image;
	progressTrack: Phaser.GameObjects.Rectangle;
	progressFill: Phaser.GameObjects.Rectangle;
	label: Phaser.GameObjects.Text;
};

const MAX_PENALTIES = 3;
const ROUND_TIME_MS = 60_000;
const ORDER_TIMEOUT_MS = 14_000;
const ORDER_WARNING_MS = 9_000;
const BREW_TIME_MS = 2_000;
const STEAM_TIME_MS = 2_000;
const ORDER_SPAWN_INTERVAL_MS = 6_200;
const MAX_ACTIVE_ORDERS = 3;

function matchesOrder(drink: Drink, order: Order) {
	return drink.cupSize === order.cupSize && drink.milk === order.milk && drink.topping === order.topping;
}

function clamp01(value: number) {
	return Phaser.Math.Clamp(value, 0, 1);
}

function chance(value: number) {
	return Math.random() < value;
}

function describeDrink(drink: Pick<Drink, "cupSize" | "milk" | "topping">) {
	return `${drink.cupSize === "small" ? "Small" : "Large"} / ${drink.milk === "none" ? "Black" : drink.milk === "regular" ? "Milk" : "Oat"} / ${drink.topping === "none" ? "Plain" : drink.topping === "chocolate" ? "Choco" : "Cinna"}`;
}

export class Minigame8Scene extends Phaser.Scene {
	private cleanupListeners: Array<() => void> = [];
	private gameStatus: "booting" | "playing" | "won" | "lost" = "booting";
	private message = "Booting coffee station...";
	private elapsedMs = 0;
	private spawnMs = 0;
	private completedOrders = 0;
	private penalties = 0;
	private nextOrderId = 0;
	private nextDrinkId = 0;
	private orders: Order[] = [];
	private orderVisuals = new Map<number, OrderVisual>();
	private heads: HeadState[] = [
		{ id: "left", status: "empty", cupSize: null, progressMs: 0 },
		{ id: "right", status: "empty", cupSize: null, progressMs: 0 },
	];
	private benches: BenchSlot[] = [
		{ id: 0, drink: null },
		{ id: 1, drink: null },
	];
	private selectedBenchId: number | null = null;
	private jug: JugState = { status: "idle", milk: null, progressMs: 0 };
	private machineSprite?: Phaser.GameObjects.Image;
	private statusText?: Phaser.GameObjects.Text;
	private helperText?: Phaser.GameObjects.Text;
	private timerText?: Phaser.GameObjects.Text;
	private orderText?: Phaser.GameObjects.Text;
	private penaltyText?: Phaser.GameObjects.Text;
	private headVisuals = new Map<HeadId, HeadVisual>();
	private benchVisuals = new Map<number, BenchVisual>();
	private jugSprite?: Phaser.GameObjects.Image;
	private jugMilkIcon?: Phaser.GameObjects.Image;
	private jugProgressTrack?: Phaser.GameObjects.Rectangle;
	private jugProgressFill?: Phaser.GameObjects.Rectangle;
	private jugLabel?: Phaser.GameObjects.Text;

	constructor() {
		super("minigame8");
	}

	create() {
		this.cameras.main.setBackgroundColor("#160d08");
		this.setupEventBridge();
		this.buildStaticScene();
		this.startRound();
		this.emitState("Queue up drinks, then tap a matching order card to serve it.");
		this.emitControls();
		gameEventBus.emit(GAME_EVENTS.SCENE_READY, { sceneKey: "Minigame 8" });
	}

	update(_time: number, delta: number) {
		if (this.gameStatus !== "playing") {
			this.updateOrderWarningVisuals();
			return;
		}

		this.elapsedMs += delta;
		this.spawnMs += delta;

		let controlsChanged = false;

		for (const head of this.heads) {
			if (head.status !== "brewing") {
				continue;
			}

			head.progressMs += delta;
			if (head.progressMs >= BREW_TIME_MS) {
				head.status = "ready";
				head.progressMs = BREW_TIME_MS;
				controlsChanged = true;
				this.message = `${head.id === "left" ? "Left" : "Right"} head is ready to pull.`;
			}
		}

		if (this.jug.status === "steaming") {
			this.jug.progressMs += delta;
			if (this.jug.progressMs >= STEAM_TIME_MS) {
				this.jug.status = "ready";
				this.jug.progressMs = STEAM_TIME_MS;
				controlsChanged = true;
				this.message = `${this.jug.milk === "regular" ? "Milk" : "Oat milk"} is ready to pour.`;
			}
		}

		const expiredIds: number[] = [];
		for (const order of this.orders) {
			order.ageMs += delta;
			if (order.ageMs >= ORDER_TIMEOUT_MS) {
				expiredIds.push(order.id);
			}
		}
		for (const orderId of expiredIds) {
			this.removeOrder(orderId);
			this.applyPenalty("An order timed out and walked away.");
			if (this.gameStatus !== "playing") {
				break;
			}
		}

		if (this.gameStatus !== "playing") {
			this.updateVisuals();
			return;
		}

		if (this.spawnMs >= ORDER_SPAWN_INTERVAL_MS && this.orders.length < MAX_ACTIVE_ORDERS) {
			this.spawnMs -= ORDER_SPAWN_INTERVAL_MS;
			this.spawnOrder();
		}

		if (this.elapsedMs >= ROUND_TIME_MS) {
			this.finishRound("won", `Closing time hit and the cafe stayed alive. You survived the rush with ${this.completedOrders} orders served.`);
		}

		if (controlsChanged) {
			this.emitControls();
		}

		this.updateVisuals();
		this.emitState(this.message);
	}

	private setupEventBridge() {
		this.cleanupListeners.forEach((cleanup) => cleanup());
		this.cleanupListeners = [
			gameEventBus.on(GAME_EVENTS.MINIGAME8_ACTION, ({ action }) => {
				this.handleAction(action);
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

	private buildStaticScene() {
		this.add.rectangle(480, 270, 960, 540, 0x2a170f, 1);
		this.add.rectangle(480, 150, 910, 110, 0x3b2418, 0.85).setStrokeStyle(2, 0xe2b06d, 0.24);
		this.add.rectangle(480, 430, 910, 170, 0x23150f, 0.94).setStrokeStyle(2, 0xe2b06d, 0.18);
		this.add.text(40, 28, "COFFEE CHAOS", { fontFamily: "Arial", fontSize: "28px", color: "#fff0d7", fontStyle: "bold" });
		this.add.text(40, 64, "Tap a bench drink to select it. When a matching order glows blue, tap that order card to serve.", {
			fontFamily: "Arial",
			fontSize: "14px",
			color: "#f3d8b4",
		});

		this.orderText = this.add.text(698, 28, "Orders 0", { fontFamily: "Arial", fontSize: "20px", color: "#fff0d7", fontStyle: "bold" });
		this.penaltyText = this.add.text(698, 56, "Penalties 0/3", { fontFamily: "Arial", fontSize: "18px", color: "#ffd0b7" });
		this.timerText = this.add.text(698, 82, "60.0s", { fontFamily: "Arial", fontSize: "18px", color: "#ffe2aa" });

		this.machineSprite = this.add.image(480, 292, "minigame8-machine");
		this.machineSprite.setDisplaySize(420, 240);

		this.add.text(362, 184, "Orders", { fontFamily: "Arial", fontSize: "18px", color: "#f7d7b2", fontStyle: "bold" }).setOrigin(0.5);
		this.add.text(480, 432, "Bench", { fontFamily: "Arial", fontSize: "18px", color: "#f7d7b2", fontStyle: "bold" }).setOrigin(0.5);
		this.add.text(778, 200, "Steam Wand", { fontFamily: "Arial", fontSize: "18px", color: "#f7d7b2", fontStyle: "bold" }).setOrigin(0.5);

		this.createHeadVisual("left", 388, 315);
		this.createHeadVisual("right", 572, 315);
		this.createBenchVisual(0, 328, 428);
		this.createBenchVisual(1, 632, 428);

		this.jugSprite = this.add.image(778, 314, "minigame8-jug-cold").setDisplaySize(92, 92);
		this.jugMilkIcon = this.add.image(778, 316, "minigame8-milk").setDisplaySize(28, 28).setVisible(false);
		this.jugProgressTrack = this.add.rectangle(778, 376, 96, 10, 0x24160d, 0.96).setStrokeStyle(1, 0xf5d2a0, 0.3);
		this.jugProgressFill = this.add.rectangle(730, 376, 0, 6, 0x8de4ff, 1).setOrigin(0, 0.5);
		this.jugLabel = this.add.text(778, 396, "Jug Empty", { fontFamily: "Arial", fontSize: "16px", color: "#f6e2c8" }).setOrigin(0.5);

		this.statusText = this.add.text(40, 478, "", { fontFamily: "Arial", fontSize: "18px", color: "#fff0d7", wordWrap: { width: 880 } });
		this.helperText = this.add.text(40, 510, "Tap a bench slot to target milk and toppings. Matching serveable orders glow blue.", { fontFamily: "Arial", fontSize: "14px", color: "#dcbfa4" });
	}

	private createHeadVisual(id: HeadId, x: number, y: number) {
		const base = this.add.rectangle(x, y, 86, 110, 0x120e0c, 0.72).setStrokeStyle(2, 0xf7d3a4, 0.25);
		const cupKey = id === "left" ? "minigame8-small-cup" : "minigame8-large-cup";
		const cup = this.add.image(x, y + 4, cupKey).setDisplaySize(48, 48).setVisible(false);
		const progressTrack = this.add.rectangle(x, y + 44, 68, 10, 0x24160d, 0.96).setStrokeStyle(1, 0xf5d2a0, 0.28);
		const progressFill = this.add.rectangle(x - 34, y + 44, 0, 6, 0x7cf0c4, 1).setOrigin(0, 0.5);
		const label = this.add.text(x, y - 56, id === "left" ? "Left Head" : "Right Head", { fontFamily: "Arial", fontSize: "16px", color: "#f7d7b2" }).setOrigin(0.5);
		this.headVisuals.set(id, { base, cup, progressTrack, progressFill, label });
	}

	private createBenchVisual(id: number, x: number, y: number) {
		const background = this.add.rectangle(x, y, 182, 116, 0x120e0c, 0.74).setStrokeStyle(2, 0xf7d3a4, 0.18);
		background.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
			if (!this.benches[id].drink || this.gameStatus !== "playing") {
				return;
			}
			this.selectedBenchId = id;
			this.message = `Selected ${id === 0 ? "left" : "right"} bench drink.`;
			this.emitControls();
			this.renderBench();
			this.emitState(this.message);
		});
		const cup = this.add.image(x - 42, y - 8, "minigame8-small-cup").setDisplaySize(48, 48).setVisible(false);
		const milk = this.add.image(x + 16, y - 10, "minigame8-milk").setDisplaySize(24, 24).setVisible(false);
		const topping = this.add.image(x + 48, y - 10, "minigame8-chocolate").setDisplaySize(24, 24).setVisible(false);
		const label = this.add.text(x, y + 34, "Empty", { fontFamily: "Arial", fontSize: "15px", color: "#d9c2a7" }).setOrigin(0.5);
		this.benchVisuals.set(id, { background, cup, milk, topping, label });
	}

	private startRound() {
		this.elapsedMs = 0;
		this.spawnMs = 0;
		this.completedOrders = 0;
		this.penalties = 0;
		this.nextOrderId = 0;
		this.nextDrinkId = 0;
		this.orders.forEach((order) => this.destroyOrderVisual(order.id));
		this.orders = [];
		this.heads = [
			{ id: "left", status: "empty", cupSize: null, progressMs: 0 },
			{ id: "right", status: "empty", cupSize: null, progressMs: 0 },
		];
		this.benches = [{ id: 0, drink: null }, { id: 1, drink: null }];
		this.selectedBenchId = null;
		this.jug = { status: "idle", milk: null, progressMs: 0 };
		this.gameStatus = "playing";
		this.spawnOrder();
		this.renderHeads();
		this.renderBench();
		this.renderJug();
		this.emitControls();
	}

	private spawnOrder() {
		if (this.orders.length >= MAX_ACTIVE_ORDERS || this.gameStatus !== "playing") {
			return;
		}

		const order: Order = {
			id: this.nextOrderId,
			cupSize: chance(0.55) ? "small" : "large",
			milk: chance(0.34) ? "none" : chance(0.62) ? "regular" : "oat",
			topping: chance(0.56) ? "none" : chance(0.58) ? "chocolate" : "cinnamon",
			ageMs: 0,
		};
		this.nextOrderId += 1;
		this.orders.push(order);
		this.buildOrderVisual(order);
		this.layoutOrders();
		this.message = "New order on the rail.";
	}

	private buildOrderVisual(order: Order) {
		const container = this.add.container(0, 0);
		const warning = this.add.rectangle(0, 0, 170, 94, 0xff8d62, 0.18).setVisible(false);
		const background = this.add.rectangle(0, 0, 164, 88, 0x120e0c, 0.92).setStrokeStyle(2, 0xf7d3a4, 0.2);
		const cup = this.add.image(-52, -4, order.cupSize === "small" ? "minigame8-small-cup" : "minigame8-large-cup").setDisplaySize(34, 34);
		const milk = order.milk === "none"
			? this.add.text(4, -8, "BLACK", { fontFamily: "Arial", fontSize: "14px", color: "#f7d7b2", fontStyle: "bold" }).setOrigin(0.5)
			: this.add.image(4, -8, order.milk === "regular" ? "minigame8-milk" : "minigame8-oat-milk").setDisplaySize(24, 24);
		const topping = order.topping === "none"
			? this.add.text(48, -8, "PLAIN", { fontFamily: "Arial", fontSize: "14px", color: "#d8b38e", fontStyle: "bold" }).setOrigin(0.5)
			: this.add.image(48, -8, order.topping === "chocolate" ? "minigame8-chocolate" : "minigame8-cinnamon").setDisplaySize(24, 24);
		const label = this.add.text(0, 22, `${order.cupSize === "small" ? "S" : "L"} / ${order.milk === "none" ? "Black" : order.milk === "regular" ? "Milk" : "Oat"} / ${order.topping === "none" ? "Plain" : order.topping === "chocolate" ? "Choco" : "Cinna"}`, {
			fontFamily: "Arial",
			fontSize: "13px",
			color: "#ffe7ca",
		}).setOrigin(0.5);
		const serveLabel = this.add.text(0, -31, "TAP TO SERVE", {
			fontFamily: "Arial",
			fontSize: "12px",
			color: "#9de8ff",
			fontStyle: "bold",
		}).setOrigin(0.5).setVisible(false);
		const timerBar = this.add.rectangle(-78, 38, 156, 8, 0x7cf0c4, 1).setOrigin(0, 0.5);
		container.add([warning, background, cup, milk, topping, label, serveLabel, timerBar]);
		container.setSize(164, 88);
		container.setInteractive(new Phaser.Geom.Rectangle(-82, -44, 164, 88), Phaser.Geom.Rectangle.Contains);
		container.on("pointerdown", () => {
			this.tryServeOrder(order.id);
		});
		this.orderVisuals.set(order.id, { container, background, timerBar, warning, serveLabel });
	}

	private destroyOrderVisual(orderId: number) {
		const visual = this.orderVisuals.get(orderId);
		if (!visual) {
			return;
		}
		visual.container.destroy(true);
		this.orderVisuals.delete(orderId);
	}

	private layoutOrders() {
		const positions = [166, 372, 578, 784];
		this.orders.forEach((order, index) => {
			const visual = this.orderVisuals.get(order.id);
			if (!visual) {
				return;
			}
			visual.container.setPosition(positions[index] ?? 784, 134);
		});
	}

	private removeOrder(orderId: number) {
		this.orders = this.orders.filter((order) => order.id !== orderId);
		this.destroyOrderVisual(orderId);
		this.layoutOrders();
	}

	private handleAction(action:
		| "small-cup"
		| "large-cup"
		| "regular-milk"
		| "oat-milk"
		| "pull-left"
		| "pull-right"
		| "pour-milk"
		| "chocolate"
		| "cinnamon") {
		if (this.gameStatus !== "playing") {
			if (action !== "small-cup" && action !== "large-cup") {
				this.message = "Round is over. Restart to open the station again.";
				this.emitState(this.message);
			}
			return;
		}

		switch (action) {
			case "small-cup":
				this.startBrew("small");
				break;
			case "large-cup":
				this.startBrew("large");
				break;
			case "regular-milk":
				this.startSteaming("regular");
				break;
			case "oat-milk":
				this.startSteaming("oat");
				break;
			case "pull-left":
				this.pullShot("left");
				break;
			case "pull-right":
				this.pullShot("right");
				break;
			case "pour-milk":
				this.pourMilk();
				break;
			case "chocolate":
				this.addTopping("chocolate");
				break;
			case "cinnamon":
				this.addTopping("cinnamon");
				break;
		}
	}

	private startBrew(cupSize: CupSize) {
		const head = this.heads.find((entry) => entry.status === "empty");
		if (!head) {
			this.message = "Both heads are busy.";
			this.emitState(this.message);
			return;
		}
		head.status = "brewing";
		head.cupSize = cupSize;
		head.progressMs = 0;
		this.message = `${cupSize === "small" ? "Small" : "Large"} cup locked under the ${head.id} head. While it brews, you can steam milk in parallel.`;
		this.renderHeads();
		this.emitControls();
		this.emitState(this.message);
	}

	private startSteaming(milk: Extract<MilkOption, "regular" | "oat">) {
		if (this.jug.status !== "idle") {
			this.message = "The jug is already steaming or ready.";
			this.emitState(this.message);
			return;
		}
		this.jug = { status: "steaming", milk, progressMs: 0 };
		this.message = `${milk === "regular" ? "Milk" : "Oat milk"} started at the steam wand.`;
		this.renderJug();
		this.emitControls();
		this.emitState(this.message);
	}

	private pullShot(headId: HeadId) {
		const head = this.heads.find((entry) => entry.id === headId);
		const slot = this.benches.find((entry) => entry.drink === null);
		if (!head || head.status !== "ready" || !head.cupSize || !slot) {
			this.message = "No bench slot free for that head.";
			this.emitState(this.message);
			return;
		}

		slot.drink = {
			id: this.nextDrinkId,
			cupSize: head.cupSize,
			milk: "none",
			topping: "none",
		};
		this.nextDrinkId += 1;
		this.selectedBenchId = slot.id;
		head.status = "empty";
		head.cupSize = null;
		head.progressMs = 0;
		this.message = `${headId === "left" ? "Left" : "Right"} shot moved to the bench. Finish it, then tap the matching order card above.`;
		this.renderHeads();
		this.renderBench();
		this.emitControls();
		this.emitState(this.message);
	}

	private pourMilk() {
		if (this.jug.status !== "ready" || this.selectedBenchId === null) {
			this.message = "Select a bench drink before pouring milk.";
			this.emitState(this.message);
			return;
		}
		const slot = this.benches[this.selectedBenchId];
		if (!slot?.drink || slot.drink.milk !== "none" || slot.drink.topping !== "none") {
			this.message = "That drink cannot take milk right now.";
			this.emitState(this.message);
			return;
		}
		slot.drink.milk = this.jug.milk ?? "none";
		this.jug = { status: "idle", milk: null, progressMs: 0 };
		this.message = `${slot.drink.milk === "regular" ? "Milk" : "Oat milk"} poured into the selected drink. Add a topping if needed, then tap the matching order.`;
		this.renderJug();
		this.renderBench();
		this.emitControls();
		this.emitState(this.message);
	}

	private addTopping(topping: Extract<ToppingOption, "chocolate" | "cinnamon">) {
		if (this.selectedBenchId === null) {
			this.message = "Select a bench drink before topping it.";
			this.emitState(this.message);
			return;
		}
		const slot = this.benches[this.selectedBenchId];
		if (!slot?.drink || slot.drink.topping !== "none") {
			this.message = "That drink already has a topping.";
			this.emitState(this.message);
			return;
		}
		slot.drink.topping = topping;
		this.message = `${topping === "chocolate" ? "Chocolate" : "Cinnamon"} added. If the drink matches an order, that order will glow blue.`;
		this.renderBench();
		this.emitControls();
		this.emitState(this.message);
	}

	private tryServeOrder(orderId: number) {
		if (this.gameStatus !== "playing") {
			return;
		}
		if (this.selectedBenchId === null) {
			this.message = "Tap a bench drink first, then tap the order to serve it.";
			this.emitState(this.message);
			return;
		}
		const slot = this.benches[this.selectedBenchId];
		const order = this.orders.find((entry) => entry.id === orderId);
		if (!slot?.drink || !order) {
			return;
		}
		if (!matchesOrder(slot.drink, order)) {
			slot.drink = null;
			this.selectedBenchId = null;
			this.renderBench();
			this.applyPenalty("Wrong drink served. The customer sent it back.");
			return;
		}

		this.removeOrder(orderId);
		slot.drink = null;
		this.selectedBenchId = null;
		this.completedOrders += 1;
		this.renderBench();
		this.emitControls();

		this.message = "Order served cleanly. Keep the line moving.";
		this.emitState(this.message);
	}

	private applyPenalty(message: string) {
		this.penalties += 1;
		this.emitControls();
		if (this.penalties >= MAX_PENALTIES) {
			this.finishRound("lost", `${message} Three strikes and the cafe falls apart.`);
			return;
		}
		this.message = message;
		this.emitState(this.message);
	}

	private finishRound(status: "won" | "lost", message: string) {
		this.gameStatus = status;
		this.message = message;
		this.emitControls();
		this.emitState(message);
	}

	private renderHeads() {
		for (const head of this.heads) {
			const visual = this.headVisuals.get(head.id);
			if (!visual) {
				continue;
			}
			visual.cup.setTexture(head.cupSize === "large" ? "minigame8-large-cup" : "minigame8-small-cup");
			visual.cup.setDisplaySize(head.cupSize === "large" ? 56 : 46, head.cupSize === "large" ? 56 : 46);
			visual.cup.setVisible(head.status !== "empty");
			const ratio = head.status === "empty" ? 0 : head.progressMs / BREW_TIME_MS;
			visual.progressFill.width = 68 * clamp01(ratio);
			visual.label.setText(
				head.status === "empty"
					? `${head.id === "left" ? "Left" : "Right"} Head`
					: head.status === "brewing"
						? `${head.id === "left" ? "Left" : "Right"} Brewing`
						: `${head.id === "left" ? "Left" : "Right"} Ready`,
			);
			visual.base.setStrokeStyle(2, head.status === "ready" ? 0x7cf0c4 : 0xf7d3a4, head.status === "ready" ? 0.8 : 0.25);
		}
	}

	private renderBench() {
		for (const slot of this.benches) {
			const visual = this.benchVisuals.get(slot.id);
			if (!visual) {
				continue;
			}
			const isSelected = this.selectedBenchId === slot.id;
			if (!slot.drink) {
				visual.background.setStrokeStyle(2, isSelected ? 0xf7d3a4 : 0xf7d3a4, isSelected ? 0.55 : 0.18);
				visual.cup.setVisible(false);
				visual.milk.setVisible(false);
				visual.topping.setVisible(false);
				visual.label.setText(`Bench ${slot.id + 1} Empty`);
				continue;
			}
			visual.background.setStrokeStyle(2, isSelected ? 0x8de4ff : 0xf7d3a4, isSelected ? 0.95 : 0.26);
			visual.cup.setTexture(slot.drink.cupSize === "large" ? "minigame8-large-cup" : "minigame8-small-cup");
			visual.cup.setDisplaySize(slot.drink.cupSize === "large" ? 56 : 46, slot.drink.cupSize === "large" ? 56 : 46);
			visual.cup.setVisible(true);
			if (slot.drink.milk === "regular") {
				visual.milk.setTexture("minigame8-milk");
				visual.milk.setVisible(true);
			} else if (slot.drink.milk === "oat") {
				visual.milk.setTexture("minigame8-oat-milk");
				visual.milk.setVisible(true);
			} else {
				visual.milk.setVisible(false);
			}
			if (slot.drink.topping === "chocolate") {
				visual.topping.setTexture("minigame8-chocolate");
				visual.topping.setVisible(true);
			} else if (slot.drink.topping === "cinnamon") {
				visual.topping.setTexture("minigame8-cinnamon");
				visual.topping.setVisible(true);
			} else {
				visual.topping.setVisible(false);
			}
			visual.label.setText(`${slot.drink.cupSize === "small" ? "Small" : "Large"} / ${slot.drink.milk === "none" ? "Black" : slot.drink.milk === "regular" ? "Milk" : "Oat"} / ${slot.drink.topping === "none" ? "Plain" : slot.drink.topping === "chocolate" ? "Choco" : "Cinna"}`);
		}
	}

	private renderJug() {
		if (!this.jugSprite || !this.jugMilkIcon || !this.jugProgressFill || !this.jugLabel) {
			return;
		}
		const ratio = this.jug.status === "idle" ? 0 : this.jug.progressMs / STEAM_TIME_MS;
		this.jugProgressFill.width = 96 * clamp01(ratio);
		if (this.jug.milk === "regular") {
			this.jugMilkIcon.setTexture("minigame8-milk");
			this.jugMilkIcon.setVisible(true);
		} else if (this.jug.milk === "oat") {
			this.jugMilkIcon.setTexture("minigame8-oat-milk");
			this.jugMilkIcon.setVisible(true);
		} else {
			this.jugMilkIcon.setVisible(false);
		}
		this.jugLabel.setText(
			this.jug.status === "idle"
				? "Jug Empty"
				: this.jug.status === "steaming"
					? `${this.jug.milk === "regular" ? "Milk" : "Oat"} Steaming`
					: `${this.jug.milk === "regular" ? "Milk" : "Oat"} Ready`,
		);
	}

	private updateOrderWarningVisuals() {
		const selectedDrink = this.selectedBenchId === null ? null : this.benches[this.selectedBenchId]?.drink ?? null;
		for (const order of this.orders) {
			const visual = this.orderVisuals.get(order.id);
			if (!visual) {
				continue;
			}
			const ratio = clamp01(1 - order.ageMs / ORDER_TIMEOUT_MS);
			visual.timerBar.width = 156 * ratio;
			const isMatchingSelected = Boolean(selectedDrink && matchesOrder(selectedDrink, order));
			visual.serveLabel.setVisible(isMatchingSelected);
			if (order.ageMs >= ORDER_WARNING_MS) {
				const blink = Math.sin(this.time.now * 0.02) > 0;
				visual.warning.setVisible(blink);
				visual.background.setStrokeStyle(2, isMatchingSelected ? 0x8de4ff : blink ? 0xff7d62 : 0xf7d3a4, isMatchingSelected ? 0.95 : blink ? 0.8 : 0.28);
				visual.container.setScale(isMatchingSelected ? 1.04 : blink ? 1.02 : 1);
			} else {
				visual.warning.setVisible(false);
				visual.background.setStrokeStyle(2, isMatchingSelected ? 0x8de4ff : 0xf7d3a4, isMatchingSelected ? 0.95 : 0.2);
				visual.container.setScale(isMatchingSelected ? 1.04 : 1);
			}
		}
	}

	private updateVisuals() {
		this.renderHeads();
		this.renderJug();
		this.renderBench();
		this.updateOrderWarningVisuals();
	}

	private emitControls() {
		const hasEmptyHead = this.heads.some((head) => head.status === "empty");
		const freeBench = this.benches.some((slot) => slot.drink === null);
		const selectedDrink = this.selectedBenchId === null ? null : this.benches[this.selectedBenchId]?.drink ?? null;
		const gameInactive = this.gameStatus !== "playing";

		gameEventBus.emit(GAME_EVENTS.MINIGAME8_CONTROLS, {
			smallCupDisabled: gameInactive || !hasEmptyHead,
			largeCupDisabled: gameInactive || !hasEmptyHead,
			regularMilkDisabled: gameInactive || this.jug.status !== "idle",
			oatMilkDisabled: gameInactive || this.jug.status !== "idle",
			pullLeftDisabled: gameInactive || !freeBench || this.heads[0]?.status !== "ready",
			pullRightDisabled: gameInactive || !freeBench || this.heads[1]?.status !== "ready",
			pourMilkDisabled: gameInactive || this.jug.status !== "ready" || !selectedDrink || selectedDrink.milk !== "none" || selectedDrink.topping !== "none",
			chocolateDisabled: gameInactive || !selectedDrink || selectedDrink.topping !== "none",
			cinnamonDisabled: gameInactive || !selectedDrink || selectedDrink.topping !== "none",
		});
	}

	private emitState(message: string) {
		this.message = message;
		this.statusText?.setText(message);
		const selectedDrink = this.selectedBenchId === null ? null : this.benches[this.selectedBenchId]?.drink ?? null;
		const hasMatchingOrder = Boolean(selectedDrink && this.orders.some((order) => matchesOrder(selectedDrink, order)));
		if (selectedDrink && hasMatchingOrder) {
			this.helperText?.setText(`Selected drink: ${describeDrink(selectedDrink)}. Tap the glowing blue order card to serve it.`);
		} else if (selectedDrink) {
			this.helperText?.setText(`Selected drink: ${describeDrink(selectedDrink)}. Finish matching its milk/topping, then tap the order card above.`);
		} else {
			this.helperText?.setText("Tap a bench slot to target milk and toppings. Matching serveable orders glow blue.");
		}
		this.orderText?.setText(`Orders ${this.completedOrders}`);
		this.penaltyText?.setText(`Penalties ${this.penalties}/${MAX_PENALTIES}`);
		this.timerText?.setText(`${Math.max(0, (ROUND_TIME_MS - this.elapsedMs) / 1000).toFixed(1)}s`);
		gameEventBus.emit(GAME_EVENTS.GAME_STATE, {
			sceneKey: "Minigame 8",
			status: this.gameStatus,
			remainingChunks: this.completedOrders,
			totalChunks: 0,
			elapsedMs: this.elapsedMs,
			playerScore: this.completedOrders,
			enemyScore: this.penalties,
			message,
		});
	}
}
