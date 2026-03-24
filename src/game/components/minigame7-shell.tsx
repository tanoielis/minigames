"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PhaserGame from "@/game/components/phaser-game";
import PlaneTurnControls from "@/game/components/plane-turn-controls";
import { GAME_EVENTS, gameEventBus, type GameStateEvent } from "@/game/event-bus";

const initialState: GameStateEvent = {
	sceneKey: "Minigame 7",
	status: "booting",
	remainingChunks: 20,
	totalChunks: 20,
	elapsedMs: 0,
	message: "Booting Phaser bridge...",
};

function formatSeconds(value: number) {
	return (value / 1000).toFixed(1);
}

export default function Minigame7Shell() {
	const [gameState, setGameState] = useState<GameStateEvent>(initialState);
	const [boostDisabled, setBoostDisabled] = useState(true);

	useEffect(() => {
		const unsubscribe = gameEventBus.on(GAME_EVENTS.GAME_STATE, (payload) => {
			if (payload.sceneKey === "Minigame 7") {
				setGameState(payload);
			}
		});
		const unsubscribeControls = gameEventBus.on(GAME_EVENTS.MINIGAME7_CONTROLS, (payload) => {
			setBoostDisabled(payload.boostDisabled);
		});

		return () => {
			unsubscribe();
			unsubscribeControls();
		};
	}, []);

	const isFinished = gameState.status === "won" || gameState.status === "lost";
	const timeLeftMs = Math.max(0, 20_000 - gameState.elapsedMs);

	return (
		<>
			<div className="h-dvh overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(125,211,252,0.26),_transparent_34%),linear-gradient(180deg,#78c9ff_0%,#15508c_36%,#0a2b4f_100%)] px-4 py-4 pb-40 text-white sm:px-8 sm:py-6 sm:pb-48 lg:px-12">
				<main className="mx-auto flex h-full w-full max-w-5xl flex-col gap-3 sm:gap-4">
					<div className="flex items-start justify-between gap-3">
						<div>
							<p className="text-xs uppercase tracking-[0.3em] text-sky-100/70">CYBER Minigames</p>
							<h1 className="mt-1 text-2xl font-semibold text-sky-50 sm:mt-2 sm:text-4xl">Cloud Run</h1>
							<p className="mt-2 max-w-2xl text-xs text-sky-50/80 sm:text-sm">
								Hold left or right to bank across the sky, dodge hostile aircraft, and stay intact for twenty seconds.
							</p>
						</div>
						<Link
							href="/"
							className="shrink-0 rounded-full border border-sky-100/35 px-3 py-2 text-xs font-medium text-sky-50 transition-colors hover:bg-sky-100 hover:text-slate-950 sm:px-4 sm:text-sm"
						>
							Back to hub
						</Link>
					</div>

					<div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.22em] text-sky-100/75 sm:text-xs">
						<div className="rounded-full border border-sky-100/20 bg-slate-950/18 px-3 py-2">Survive {formatSeconds(timeLeftMs)}s</div>
						<div className="rounded-full border border-sky-100/20 bg-slate-950/18 px-3 py-2">Controls: Hold left or right</div>
					</div>

					<div className="relative min-h-0 flex-1">
						<PhaserGame startSceneKey="minigame7" />

						{isFinished ? (
							<div className="absolute inset-0 flex items-center justify-center rounded-[1.5rem] bg-slate-950/44 p-4 backdrop-blur-sm sm:p-6">
								<div className="w-full max-w-sm rounded-[1.75rem] border border-sky-100/20 bg-slate-950/88 px-5 py-6 text-center shadow-[0_18px_60px_rgba(14,116,144,0.28)] sm:max-w-md sm:px-6 sm:py-7">
									<p className="text-xs uppercase tracking-[0.35em] text-sky-100/60">Flight Complete</p>
									<h2 className="mt-3 text-2xl font-semibold text-sky-50 sm:text-3xl">
										{gameState.status === "won" ? "Still Airborne" : "Splashdown"}
									</h2>
									<p className="mt-3 text-sm text-sky-50/82">{gameState.message}</p>
									<p className="mt-2 text-sm text-sky-100/65">Flight time: {formatSeconds(gameState.elapsedMs)}s</p>
									<div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row sm:justify-center">
										<button
											type="button"
											onClick={() => gameEventBus.emit(GAME_EVENTS.RESTART_GAME, { sceneKey: "minigame7" })}
											className="rounded-full bg-sky-100 px-5 py-3 text-sm font-semibold text-slate-950 transition-transform hover:-translate-y-0.5"
										>
											Restart Minigame
										</button>
										<Link
											href="/"
											className="rounded-full border border-sky-100/35 px-5 py-3 text-sm font-semibold text-sky-50 transition-colors hover:bg-sky-100 hover:text-slate-950"
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

			<PlaneTurnControls disabled={isFinished || gameState.status === "booting"} boostDisabled={boostDisabled} />
		</>
	);
}