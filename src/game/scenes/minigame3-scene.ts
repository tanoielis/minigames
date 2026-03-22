import * as Phaser from "phaser";
import { GAME_EVENTS, gameEventBus } from "@/game/event-bus";

type EndpointSide = "start" | "end";

type ShapeKind =
	| "circle"
	| "square"
	| "triangle"
	| "diamond"
	| "star"
	| "hexagon"
	| "pentagon"
	| "cross"
	| "plus"
	| "chevron"
	| "moon"
	| "drop";

type NodeVisualState = "idle" | "source" | "success" | "failure" | "pressed";

type ShapeNode = {
	endpointId: string;
	wireId: number;
	side: EndpointSide;
	shapeKind: ShapeKind;
	x: number;
	y: number;
	visible: boolean;
	interactive: boolean;
	state: NodeVisualState;
};

type WireDescriptor = {
	id: number;
	startSlot: number;
	endSlot: number;
	startShape: ShapeKind;
	endShape: ShapeKind;
	spirals: number;
	direction: 1 | -1;
	color: number;
	graphics: Phaser.GameObjects.Graphics;
	startNode?: ShapeNode;
	endNode?: ShapeNode;
};

type PromptState = {
	sourceId: string;
	targetId: string;
	wireId: number;
	sourceSide: EndpointSide;
	targetSide: EndpointSide;
};

const TOTAL_ROUNDS = 6;
const SLOT_COUNT = 12;
const BOARD_RADIUS = 224;
const ENDPOINT_RADIUS = 244;
const INNER_RADIUS = 54;
const CENTER_X = 480;
const CENTER_Y = 270;
const RED_WIRE = 0xff5d73;
const BLUE_WIRE = 0x56c2ff;
const GREEN_WIRE = 0x6efc8c;
const YELLOW_WIRE = 0xf4f96f;
const PURPLE_WIRE = 0xd66fff;
const ORANGE_WIRE = 0xffb86c;
const WIRE_COLORS = [RED_WIRE, BLUE_WIRE, GREEN_WIRE, YELLOW_WIRE, PURPLE_WIRE, ORANGE_WIRE];
const SHAPE_KINDS: ShapeKind[] = [
	"circle",
	"square",
	"triangle",
	"diamond",
	"star",
	"hexagon",
	"pentagon",
	"cross",
	"plus",
	"chevron",
	"moon",
	"drop",
];

function getSlotAngle(slot: number) {
	return -Math.PI / 2 + (slot / SLOT_COUNT) * Math.PI * 2;
}

function getSlotPoint(slot: number, radius: number) {
	const angle = getSlotAngle(slot);
	return {
		x: CENTER_X + Math.cos(angle) * radius,
		y: CENTER_Y + Math.sin(angle) * radius,
	};
}

function getWireCount(round: number) {
	return 2 + Math.floor(round / 2);
}

export class Minigame3Scene extends Phaser.Scene {
	private cleanupListeners: Array<() => void> = [];
	private boardGraphics?: Phaser.GameObjects.Graphics;
	private wires: WireDescriptor[] = [];
	private nodes: ShapeNode[] = [];
	private roundNumber = 0;
	private nextWireColorIndex = 0;
	private prompt?: PromptState;
	private roundElapsedMs = 0;
	private gameStatus: "booting" | "playing" | "won" | "lost" = "booting";
	private awaitingInput = false;
	private promptTimer?: Phaser.Time.TimerEvent;
	private roundDelay?: Phaser.Time.TimerEvent;

	constructor() {
		super("minigame3");
	}

	create() {
		this.cameras.main.setBackgroundColor("#120d19");
		this.setupEventBridge();
		this.buildBackdrop();
		this.startGame();
		gameEventBus.emit(GAME_EVENTS.SCENE_READY, { sceneKey: "Minigame 3" });
	}

	update(_time: number, delta: number) {
		if (this.gameStatus !== "playing") {
			return;
		}

		this.roundElapsedMs += delta;
	}

	private setupEventBridge() {
		this.cleanupListeners.forEach((cleanup) => cleanup());
		this.cleanupListeners = [
			gameEventBus.on(GAME_EVENTS.MINIGAME3_SELECT_ENDPOINT, ({ endpointId }) => {
				this.handleShapeSelected(endpointId);
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
		this.boardGraphics = this.add.graphics();
		this.drawBoard();
	}

	private drawBoard() {
		if (!this.boardGraphics) {
			return;
		}

		this.boardGraphics.clear();
		this.boardGraphics.fillStyle(0xf6f2f9, 0.96);
		this.boardGraphics.fillCircle(CENTER_X, CENTER_Y, BOARD_RADIUS + 28);
		this.boardGraphics.lineStyle(4, 0x211828, 0.12);
		this.boardGraphics.strokeCircle(CENTER_X, CENTER_Y, BOARD_RADIUS + 14);
	}

	private startGame() {
		this.roundNumber = 0;
		this.nextWireColorIndex = 0;
		this.roundElapsedMs = 0;
		this.startNextRound();
	}

	private startNextRound() {
		this.roundNumber += 1;

		if (this.roundNumber > TOTAL_ROUNDS) {
			this.finishGame("won", "You traced every live signal through the entanglement.");
			return;
		}

		this.clearRoundObjects();
		this.awaitingInput = false;
		this.prompt = undefined;
		this.gameStatus = "playing";

		const wireCount = getWireCount(this.roundNumber);
		this.generateRound(wireCount);
		this.emitGameState(`Round ${this.roundNumber} of ${TOTAL_ROUNDS}. Study the wire maze before the target lights up.`);

		this.roundDelay?.destroy();
		this.roundDelay = this.time.delayedCall(2000, () => {
			this.beginPrompt();
		});
	}

	private generateRound(wireCount: number) {
		const slots = Phaser.Utils.Array.Shuffle(Array.from({ length: SLOT_COUNT }, (_, index) => index));
		const selectedSlots = slots.slice(0, wireCount * 2);
		const startSlots = selectedSlots.slice(0, wireCount).sort((left, right) => left - right);
		const endSlotsBase = selectedSlots.slice(wireCount).sort((left, right) => right - left);
		const rotation = Phaser.Math.Between(0, Math.max(0, wireCount - 1));
		const endSlots = endSlotsBase.map((_, index) => endSlotsBase[(index + rotation) % wireCount]);
		const shapes = Phaser.Utils.Array.Shuffle([...SHAPE_KINDS]).slice(0, wireCount * 2);

		this.wires = Array.from({ length: wireCount }, (_, index) => ({
			id: index,
			startSlot: startSlots[index],
			endSlot: endSlots[index],
			startShape: shapes[index * 2],
			endShape: shapes[index * 2 + 1],
			spirals: Phaser.Math.Between(0, 2),
			direction: Phaser.Math.Between(0, 1) === 0 ? -1 : 1,
			color: WIRE_COLORS[this.nextWireColorIndex++ % WIRE_COLORS.length],
			graphics: this.add.graphics(),
		}));

		this.wires.forEach((wire) => {
			this.drawWire(wire);
			wire.startNode = this.createShapeNode(wire, "start");
			wire.endNode = this.createShapeNode(wire, "end");
		});

		this.emitLayout();
	}

	private drawWire(wire: WireDescriptor) {
		const startAngle = getSlotAngle(wire.startSlot);
		const endAngle = getSlotAngle(wire.endSlot);
		const baseDelta = Phaser.Math.Angle.Wrap(endAngle - startAngle);
		const totalDelta = baseDelta + wire.direction * wire.spirals * Math.PI * 2;
		const points = Array.from({ length: 48 }, (_, index) => {
			const t = index / 47;
			const angle = startAngle + totalDelta * t;
			const radius = INNER_RADIUS + (ENDPOINT_RADIUS - INNER_RADIUS) * Math.abs(2 * t - 1) + Math.sin(t * Math.PI * 2) * 10;
			return new Phaser.Math.Vector2(CENTER_X + Math.cos(angle) * radius, CENTER_Y + Math.sin(angle) * radius);
		});

		wire.graphics.clear();
		wire.graphics.lineStyle(10, 0x0a0910, 0.18);
		wire.graphics.strokePoints(points, false, false);
		wire.graphics.lineStyle(5, wire.color, 0.96);
		wire.graphics.strokePoints(points, false, false);
		wire.graphics.setDepth(6);
	}

	private createShapeNode(wire: WireDescriptor, side: EndpointSide) {
		const slot = side === "start" ? wire.startSlot : wire.endSlot;
		const shapeKind = side === "start" ? wire.startShape : wire.endShape;
		const point = getSlotPoint(slot, ENDPOINT_RADIUS);
		const endpointId = `${wire.id}-${side}`;

		const node: ShapeNode = {
			endpointId,
			wireId: wire.id,
			side,
			shapeKind,
			x: point.x,
			y: point.y,
			visible: true,
			interactive: false,
			state: "idle",
		};

		this.nodes.push(node);
		return node;
	}

	private beginPrompt() {
		const wire = Phaser.Utils.Array.GetRandom(this.wires);
		const sourceSide: EndpointSide = Phaser.Math.Between(0, 1) === 0 ? "start" : "end";
		const targetSide: EndpointSide = sourceSide === "start" ? "end" : "start";
		const sourceId = `${wire.id}-${sourceSide}`;
		const targetId = `${wire.id}-${targetSide}`;

		this.prompt = {
			sourceId,
			targetId,
			wireId: wire.id,
			sourceSide,
			targetSide,
		};
		this.awaitingInput = true;
		this.refreshNodeVisuals();
		this.emitGameState("The signal is live. Tap the matching symbol at the other end before the timer closes.");

		this.promptTimer?.destroy();
		this.promptTimer = this.time.delayedCall(5000, () => {
			if (this.awaitingInput) {
				this.finishGame("lost", "The live signal timed out before you found its matching endpoint.");
			}
		});
	}

	private handleShapeSelected(endpointId: string) {
		if (!this.awaitingInput || !this.prompt) {
			return;
		}

		const selectedNode = this.nodes.find((node) => node.endpointId === endpointId);
		if (!selectedNode || !selectedNode.interactive) {
			return;
		}

		selectedNode.state = "pressed";
		this.emitLayout();
		this.awaitingInput = false;
		this.promptTimer?.destroy();

		if (endpointId === this.prompt.targetId) {
			this.refreshNodeVisuals("success");
			this.emitGameState("Signal matched. The wire map is about to reconfigure.");
			this.roundDelay?.destroy();
			this.roundDelay = this.time.delayedCall(700, () => {
				this.startNextRound();
			});
			return;
		}

		this.refreshNodeVisuals("failure", endpointId);
		this.finishGame("lost", "That endpoint belongs to a different wire. The signal slipped away.");
	}

	private refreshNodeVisuals(state: "idle" | "success" | "failure" = "idle", failedId?: string) {
		this.nodes.forEach((node) => {
			if (!this.prompt) {
				node.state = "idle";
				node.interactive = false;
				return;
			}

			if (state === "success" && (node.endpointId === this.prompt.sourceId || node.endpointId === this.prompt.targetId)) {
				node.state = "success";
				node.interactive = false;
				return;
			}

			if (state === "failure") {
				if (node.endpointId === this.prompt.sourceId) {
					node.state = "source";
					node.interactive = false;
					return;
				}

				if (node.endpointId === this.prompt.targetId) {
					node.state = "success";
					node.interactive = false;
					return;
				}

				if (node.endpointId === failedId) {
					node.state = "failure";
					node.interactive = false;
					return;
				}
			}

			if (node.endpointId === this.prompt.sourceId) {
				node.state = "source";
				node.interactive = false;
				return;
			}

			node.state = "idle";
			node.interactive = node.endpointId !== this.prompt.sourceId;
		});

		this.emitLayout();
	}

	private emitLayout() {
		gameEventBus.emit(GAME_EVENTS.MINIGAME3_LAYOUT, {
			endpoints: this.nodes.map((node) => ({
				endpointId: node.endpointId,
				shapeKind: node.shapeKind,
				x: node.x,
				y: node.y,
				visible: node.visible,
				interactive: node.interactive,
				state: node.state,
			})),
		});
	}

	private clearRoundObjects() {
		this.promptTimer?.destroy();
		this.roundDelay?.destroy();
		this.prompt = undefined;

		this.wires.forEach((wire) => {
			wire.graphics.destroy();
		});
		this.wires = [];
		this.nodes = [];
		this.emitLayout();
	}

	private emitGameState(message: string) {
		gameEventBus.emit(GAME_EVENTS.GAME_STATE, {
			sceneKey: "Minigame 3",
			status: this.gameStatus,
			remainingChunks: Math.max(0, TOTAL_ROUNDS - this.roundNumber + (this.gameStatus === "playing" ? 1 : 0)),
			totalChunks: TOTAL_ROUNDS,
			elapsedMs: this.roundElapsedMs,
			message,
		});
	}

	private finishGame(status: "won" | "lost", message: string) {
		this.gameStatus = status;
		this.awaitingInput = false;
		this.promptTimer?.destroy();
		this.roundDelay?.destroy();
		this.nodes.forEach((node) => {
			node.interactive = false;
		});
		this.emitLayout();
		this.emitGameState(message);
	}
}