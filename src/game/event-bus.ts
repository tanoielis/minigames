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
		message: string;
	};
	"restart-game": {
		sceneKey: string;
	};
	"action-press": {
		active: boolean;
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
} as const;

export type GameStateEvent = GameEventMap[typeof GAME_EVENTS.GAME_STATE];

export const gameEventBus = new GameEventBus();