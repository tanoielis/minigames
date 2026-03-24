"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PhaserGame from "@/game/components/phaser-game";
import JoystickControl from "@/game/components/joystick-control";
import { GAME_EVENTS, gameEventBus, type GameStateEvent } from "@/game/event-bus";

const initialState: GameStateEvent = {
	sceneKey: "Minigame 1",
	status: "booting",
	remainingChunks: 10,
	totalChunks: 10,
	elapsedMs: 0,
	message: "Booting Phaser bridge...",
};

function formatSeconds(value: number) {
	return (value / 1000).toFixed(1);
}

export default function Minigame1Shell() {
	const [gameState, setGameState] = useState<GameStateEvent>(initialState);

	useEffect(() => {
		const unsubscribe = gameEventBus.on(GAME_EVENTS.GAME_STATE, (payload) => {
			if (payload.sceneKey === "Minigame 1") {
				setGameState(payload);
			}
		});

		return unsubscribe;
	}, []);

	const isFinished = gameState.status === "won" || gameState.status === "lost";

	return (
		<>
			<div className="h-dvh overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(0,255,208,0.14),_transparent_32%),linear-gradient(180deg,#07111f_0%,#04070d_100%)] px-4 py-4 pb-40 text-white sm:px-8 sm:py-6 sm:pb-48 lg:px-12">
				<main className="mx-auto flex h-full w-full max-w-5xl flex-col gap-3 sm:gap-4">
					<div className="flex items-start justify-between gap-3">
						<div>
							<p className="text-xs uppercase tracking-[0.3em] text-cyan-300/70">CYBER Minigames</p>
							<h1 className="mt-1 text-2xl font-semibold text-cyan-100 sm:mt-2 sm:text-4xl">Penguin Panic</h1>
							<p className="mt-2 max-w-2xl text-xs text-slate-300 sm:text-sm">
								Guide the penguin across a floating ice floe. Hidden chunks will start to sink one by one, and you win if you survive until only three remain.
							</p>
						</div>
						<Link
							href="/"
							className="shrink-0 rounded-full border border-cyan-300/40 px-3 py-2 text-xs font-medium text-cyan-100 transition-colors hover:bg-cyan-300 hover:text-slate-950 sm:px-4 sm:text-sm"
						>
							Back to Menu
						</Link>
					</div>

					<div className="relative min-h-0 flex-1">
						<PhaserGame startSceneKey="minigame1" />

						{isFinished ? (
							<div className="absolute inset-0 flex items-center justify-center rounded-[1.5rem] bg-slate-950/70 p-4 backdrop-blur-sm sm:p-6">
								<div className="w-full max-w-sm rounded-[1.75rem] border border-cyan-300/25 bg-slate-950/90 px-5 py-6 text-center shadow-[0_18px_60px_rgba(34,211,238,0.16)] sm:max-w-md sm:px-6 sm:py-7">
									<p className="text-xs uppercase tracking-[0.35em] text-cyan-300/70">Game Over</p>
									<h2 className="mt-3 text-2xl font-semibold text-cyan-100 sm:text-3xl">
										{gameState.status === "won" ? "You Survived" : "Penguin Overboard"}
									</h2>
									<p className="mt-3 text-sm text-slate-300">{gameState.message}</p>
									<p className="mt-2 text-sm text-slate-400">Final time: {formatSeconds(gameState.elapsedMs)}s</p>
									<div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row sm:justify-center">
										<button
											type="button"
											onClick={() => gameEventBus.emit(GAME_EVENTS.RESTART_GAME, { sceneKey: "minigame1" })}
											className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition-transform hover:-translate-y-0.5"
										>
											Restart Minigame
										</button>
										<Link
											href="/"
											className="rounded-full border border-cyan-300/35 px-5 py-3 text-sm font-semibold text-cyan-100 transition-colors hover:bg-cyan-300 hover:text-slate-950"
										>
											Back to Menu
										</Link>
									</div>
								</div>
							</div>
						) : null}
					</div>
				</main>
			</div>

			<JoystickControl disabled={isFinished || gameState.status === "booting"} />
		</>
	);
}