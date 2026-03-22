"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PhaserGame from "@/game/components/phaser-game";
import { GAME_EVENTS, gameEventBus, type GameStateEvent } from "@/game/event-bus";

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

type LayoutEndpoint = {
	endpointId: string;
	shapeKind: ShapeKind;
	x: number;
	y: number;
	visible: boolean;
	interactive: boolean;
	state: "idle" | "source" | "success" | "failure" | "pressed";
};

const initialState: GameStateEvent = {
	sceneKey: "Minigame 3",
	status: "booting",
	remainingChunks: 6,
	totalChunks: 6,
	elapsedMs: 0,
	message: "Booting Phaser bridge...",
};

function formatSeconds(value: number) {
	return (value / 1000).toFixed(1);
}

function shapeMarkup(shapeKind: ShapeKind) {
	switch (shapeKind) {
		case "circle":
			return <circle cx="32" cy="32" r="17" />;
		case "square":
			return <rect x="16" y="16" width="32" height="32" rx="8" />;
		case "triangle":
			return <path d="M32 12 L50 48 L14 48 Z" />;
		case "diamond":
			return <path d="M32 10 L52 32 L32 54 L12 32 Z" />;
		case "star":
			return <path d="M32 11 L38 24 L53 25 L41 35 L45 50 L32 42 L19 50 L23 35 L11 25 L26 24 Z" />;
		case "hexagon":
			return <path d="M20 15 L44 15 L56 32 L44 49 L20 49 L8 32 Z" />;
		case "pentagon":
			return <path d="M32 10 L52 25 L45 50 L19 50 L12 25 Z" />;
		case "cross":
			return <path d="M22 12 H42 V22 H52 V42 H42 V52 H22 V42 H12 V22 H22 Z" />;
		case "plus":
			return <path d="M28 10 H36 V28 H54 V36 H36 V54 H28 V36 H10 V28 H28 Z" />;
		case "chevron":
			return <path d="M16 24 L32 40 L48 24 L40 16 L32 24 L24 16 Z" />;
		case "moon":
			return <path d="M39 11 C27 14 18 24 18 35 C18 46 27 54 39 53 C33 48 30 41 30 33 C30 24 33 17 39 11 Z" />;
		case "drop":
			return <path d="M32 8 L45 24 C49 29 50 34 50 39 C50 49 42 56 32 56 C22 56 14 49 14 39 C14 34 15 29 19 24 Z" />;
	}
}

function endpointPalette(state: LayoutEndpoint["state"]) {
	if (state === "source") {
		return {
			button: "border-pink-300 bg-pink-300/20 text-pink-100 shadow-[0_0_24px_rgba(244,114,182,0.45)]",
			svg: "fill-pink-100 stroke-slate-950",
		};
	}

	if (state === "success") {
		return {
			button: "border-emerald-300 bg-emerald-300/25 text-emerald-100 shadow-[0_0_24px_rgba(110,231,183,0.4)]",
			svg: "fill-emerald-100 stroke-slate-950",
		};
	}

	if (state === "failure") {
		return {
			button: "border-rose-400 bg-rose-400/25 text-rose-100 shadow-[0_0_24px_rgba(251,113,133,0.45)]",
			svg: "fill-rose-100 stroke-slate-950",
		};
	}

	if (state === "pressed") {
		return {
			button: "border-cyan-300 bg-cyan-300/22 text-cyan-100 scale-95 shadow-[0_0_24px_rgba(103,232,249,0.42)]",
			svg: "fill-cyan-100 stroke-slate-950",
		};
	}

	return {
		button: "border-white/65 bg-slate-950/72 text-white shadow-[0_0_16px_rgba(255,255,255,0.08)]",
		svg: "fill-white stroke-slate-950",
	};
}

export default function Minigame3Shell() {
	const [gameState, setGameState] = useState<GameStateEvent>(initialState);
	const [endpoints, setEndpoints] = useState<LayoutEndpoint[]>([]);

	useEffect(() => {
		const unsubscribeState = gameEventBus.on(GAME_EVENTS.GAME_STATE, (payload) => {
			if (payload.sceneKey === "Minigame 3") {
				setGameState(payload);
			}
		});
		const unsubscribeLayout = gameEventBus.on(GAME_EVENTS.MINIGAME3_LAYOUT, ({ endpoints: nextEndpoints }) => {
			setEndpoints(nextEndpoints);
		});

		return () => {
			unsubscribeState();
			unsubscribeLayout();
		};
	}, []);

	const isFinished = gameState.status === "won" || gameState.status === "lost";

	return (
		<div className="h-dvh overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(244,114,182,0.14),_transparent_34%),linear-gradient(180deg,#140f1f_0%,#08070d_100%)] px-4 py-4 text-white sm:px-8 sm:py-6 lg:px-12">
			<main className="mx-auto flex h-full w-full max-w-5xl flex-col gap-3 sm:gap-4">
				<div className="flex items-start justify-between gap-3">
					<div>
						<p className="text-xs uppercase tracking-[0.3em] text-pink-300/70">CYBER Minigames</p>
						<h1 className="mt-1 text-2xl font-semibold text-pink-100 sm:mt-2 sm:text-4xl">Entanglement</h1>
						<p className="mt-2 max-w-2xl text-xs text-slate-300 sm:text-sm">
							Trace the lit symbol through the tangle and click its matching partner before the timer closes.
						</p>
					</div>
					<Link
						href="/"
						className="shrink-0 rounded-full border border-pink-300/40 px-3 py-2 text-xs font-medium text-pink-100 transition-colors hover:bg-pink-300 hover:text-slate-950 sm:px-4 sm:text-sm"
					>
						Back to hub
					</Link>
				</div>

				<div className="relative min-h-0 flex-1">
					<PhaserGame startSceneKey="minigame3">
						<div className="pointer-events-none absolute inset-0">
							{endpoints.map((endpoint) => {
								if (!endpoint.visible) {
									return null;
								}

								const palette = endpointPalette(endpoint.state);

								return (
									<button
										key={endpoint.endpointId}
										type="button"
										disabled={!endpoint.interactive || isFinished}
										onClick={() => gameEventBus.emit(GAME_EVENTS.MINIGAME3_SELECT_ENDPOINT, { endpointId: endpoint.endpointId })}
										className={`pointer-events-auto absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 transition-all duration-120 ${palette.button} ${endpoint.interactive && !isFinished ? "cursor-pointer hover:scale-105" : "cursor-default opacity-85"}`}
										style={{
											left: `${(endpoint.x / 960) * 100}%`,
											top: `${(endpoint.y / 540) * 100}%`,
										}}
										aria-label={`Select ${endpoint.shapeKind} endpoint`}
									>
										<svg viewBox="0 0 64 64" className={`h-9 w-9 stroke-[3] ${palette.svg}`} aria-hidden="true">
											{shapeMarkup(endpoint.shapeKind)}
										</svg>
									</button>
								);
							})}
						</div>
					</PhaserGame>

					{isFinished ? (
						<div className="absolute inset-0 flex items-center justify-center rounded-[1.5rem] bg-slate-950/72 p-4 backdrop-blur-sm sm:p-6">
							<div className="w-full max-w-sm rounded-[1.75rem] border border-pink-300/25 bg-slate-950/92 px-5 py-6 text-center shadow-[0_18px_60px_rgba(244,114,182,0.12)] sm:max-w-md sm:px-6 sm:py-7">
								<p className="text-xs uppercase tracking-[0.35em] text-pink-300/70">Game Over</p>
								<h2 className="mt-3 text-2xl font-semibold text-pink-100 sm:text-3xl">
									{gameState.status === "won" ? "Signal Traced" : "Signal Lost"}
								</h2>
								<p className="mt-3 text-sm text-slate-300">{gameState.message}</p>
								<p className="mt-2 text-sm text-slate-400">Elapsed time: {formatSeconds(gameState.elapsedMs)}s</p>
								<div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row sm:justify-center">
									<button
										type="button"
										onClick={() => gameEventBus.emit(GAME_EVENTS.RESTART_GAME, { sceneKey: "minigame3" })}
										className="rounded-full bg-pink-300 px-5 py-3 text-sm font-semibold text-slate-950 transition-transform hover:-translate-y-0.5"
									>
										Restart Minigame
									</button>
									<Link
										href="/"
										className="rounded-full border border-pink-300/35 px-5 py-3 text-sm font-semibold text-pink-100 transition-colors hover:bg-pink-300 hover:text-slate-950"
									>
										Back to Main Page
									</Link>
								</div>
							</div>
						</div>
					) : null}
				</div>
			</main>
		</div>
	);
}