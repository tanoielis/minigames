type GameEventMap = {
	"scene-ready": {
		sceneKey: string;
		instanceId?: string;
	};
	"minigame3-layout": {
		endpoints: Array<{
			endpointId: string;
			shapeKind:
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
			x: number;
			y: number;
			visible: boolean;
			interactive: boolean;
			state: "idle" | "source" | "success" | "failure" | "pressed";
		}>;
	};
	"minigame3-select-endpoint": {
		endpointId: string;
	};
	"input-move": {
		x: number;
		y: number;
		active: boolean;
	};
	"game-state": {
		sceneKey: string;
		instanceId?: string;
		status: "booting" | "playing" | "won" | "lost";
		remainingChunks: number;
		totalChunks: number;
		elapsedMs: number;
		roundTimeMs?: number;
		currentRound?: number;
		playerScore?: number;
		enemyScore?: number;
		message: string;
	};
	"restart-game": {
		sceneKey: string;
	};
	"action-press": {
		active: boolean;
	};
	"minigame8-action": {
		action:
			| "small-cup"
			| "large-cup"
			| "regular-milk"
			| "oat-milk"
			| "pull-left"
			| "pull-right"
			| "pour-milk"
			| "chocolate"
			| "cinnamon";
	};
	"minigame8-controls": {
		smallCupDisabled: boolean;
		largeCupDisabled: boolean;
		regularMilkDisabled: boolean;
		oatMilkDisabled: boolean;
		pullLeftDisabled: boolean;
		pullRightDisabled: boolean;
		pourMilkDisabled: boolean;
		chocolateDisabled: boolean;
		cinnamonDisabled: boolean;
	};
	"minigame9-action": {
		action: "deal" | "hit" | "stand";
	};
	"boxing-action": {
		action: "jab" | "hook" | "block";
	};
	"minigame6-controls": {
		jabDisabled: boolean;
		hookDisabled: boolean;
		blockDisabled: boolean;
	};
	"minigame7-turn": {
		left: boolean;
		right: boolean;
	};
	"minigame7-boost": {
		active: boolean;
	};
	"minigame7-controls": {
		boostDisabled: boolean;
	};
};

type GameEventName = keyof GameEventMap;
type GameEventHandler<T extends GameEventName> = (payload: GameEventMap[T]) => void;

class GameEventBus {
	private target = new EventTarget();

	emit<T extends GameEventName>(type: T, payload: GameEventMap[T]) {
		this.target.dispatchEvent(new CustomEvent(type, { detail: payload }));
	}

	on<T extends GameEventName>(type: T, handler: GameEventHandler<T>) {
		const listener: EventListener = (event) => {
			handler((event as CustomEvent<GameEventMap[T]>).detail);
		};

		this.target.addEventListener(type, listener);
		return () => {
			this.target.removeEventListener(type, listener);
		};
	}
}

export const GAME_EVENTS = {
	SCENE_READY: "scene-ready",
	MINIGAME3_LAYOUT: "minigame3-layout",
	MINIGAME3_SELECT_ENDPOINT: "minigame3-select-endpoint",
	INPUT_MOVE: "input-move",
	GAME_STATE: "game-state",
	RESTART_GAME: "restart-game",
	ACTION_PRESS: "action-press",
	MINIGAME8_ACTION: "minigame8-action",
	MINIGAME8_CONTROLS: "minigame8-controls",
	BOXING_ACTION: "boxing-action",
	MINIGAME6_CONTROLS: "minigame6-controls",
	MINIGAME7_TURN: "minigame7-turn",
	MINIGAME9_ACTION: "minigame9-action",
	MINIGAME7_BOOST: "minigame7-boost",
	MINIGAME7_CONTROLS: "minigame7-controls",
} as const;

export type GameStateEvent = GameEventMap[typeof GAME_EVENTS.GAME_STATE];

export const gameEventBus = new GameEventBus();