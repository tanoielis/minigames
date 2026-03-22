"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ActionButtonControl from "@/game/components/action-button-control";
import PhaserGame from "@/game/components/phaser-game";
import { GAME_EVENTS, gameEventBus, type GameStateEvent } from "@/game/event-bus";

const initialState: GameStateEvent = {
	sceneKey: "Minigame 2",
	status: "booting",
	remainingChunks: 10,
	totalChunks: 10,
	elapsedMs: 0,
	message: "Booting Phaser bridge...",
};

function formatSeconds(value: number) {
	return (value / 1000).toFixed(1);
}

export default function Minigame2Shell() {
	const [gameState, setGameState] = useState<GameStateEvent>(initialState);

	useEffect(() => {
		const unsubscribe = gameEventBus.on(GAME_EVENTS.GAME_STATE, (payload) => {
			if (payload.sceneKey === "Minigame 2") {
				setGameState(payload);
			}
		});

		return unsubscribe;
	}, []);

	const isFinished = gameState.status === "won" || gameState.status === "lost";

	return (
		<>
			<div className="h-dvh overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,196,87,0.15),_transparent_32%),linear-gradient(180deg,#0f172a_0%,#090b12_100%)] px-4 py-4 pb-40 text-white sm:px-8 sm:py-6 sm:pb-48 lg:px-12">
				<main className="mx-auto flex h-full w-full max-w-5xl flex-col gap-3 sm:gap-4">
					<div className="flex items-start justify-between gap-3">
						<div>
							<p className="text-xs uppercase tracking-[0.3em] text-amber-300/70">CYBER Minigames</p>
							<h1 className="mt-1 text-2xl font-semibold text-amber-100 sm:mt-2 sm:text-4xl">Skater City</h1>
							<p className="mt-2 max-w-2xl text-xs text-slate-300 sm:text-sm">
								Press the action button to jump. Clear all ten holes in this side-scrolling skate run to win.
							</p>
						</div>
						<Link
							href="/"
							className="shrink-0 rounded-full border border-amber-300/40 px-3 py-2 text-xs font-medium text-amber-100 transition-colors hover:bg-amber-300 hover:text-slate-950 sm:px-4 sm:text-sm"
						>
							Back to hub
						</Link>
					</div>

					<div className="relative min-h-0 flex-1">
						<PhaserGame startSceneKey="minigame2" />

						{isFinished ? (
							<div className="absolute inset-0 flex items-center justify-center rounded-[1.5rem] bg-slate-950/70 p-4 backdrop-blur-sm sm:p-6">
								<div className="w-full max-w-sm rounded-[1.75rem] border border-amber-300/25 bg-slate-950/90 px-5 py-6 text-center shadow-[0_18px_60px_rgba(251,191,36,0.12)] sm:max-w-md sm:px-6 sm:py-7">
									<p className="text-xs uppercase tracking-[0.35em] text-amber-300/70">Game Over</p>
									<h2 className="mt-3 text-2xl font-semibold text-amber-100 sm:text-3xl">
										{gameState.status === "won" ? "Run Cleared" : "Bail Out"}
									</h2>
									<p className="mt-3 text-sm text-slate-300">{gameState.message}</p>
									<p className="mt-2 text-sm text-slate-400">Final time: {formatSeconds(gameState.elapsedMs)}s</p>
									<div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row sm:justify-center">
										<button
											type="button"
											onClick={() => gameEventBus.emit(GAME_EVENTS.RESTART_GAME, {})}
											className="rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-slate-950 transition-transform hover:-translate-y-0.5"
										>
											Restart Minigame
										</button>
										<Link
											href="/"
											className="rounded-full border border-amber-300/35 px-5 py-3 text-sm font-semibold text-amber-100 transition-colors hover:bg-amber-300 hover:text-slate-950"
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

			<ActionButtonControl disabled={isFinished || gameState.status === "booting"} label="Jump" />
		</>
	);
}