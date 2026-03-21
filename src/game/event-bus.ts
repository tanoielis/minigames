type GameEventMap = {
	"scene-ready": {
		sceneKey: string;
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
} as const;

export const gameEventBus = new GameEventBus();