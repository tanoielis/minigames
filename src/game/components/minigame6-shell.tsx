"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BoxingControls from "@/game/components/boxing-controls";
import PhaserGame from "@/game/components/phaser-game";
import { GAME_EVENTS, gameEventBus, type GameStateEvent } from "@/game/event-bus";

const initialState: GameStateEvent = {
	sceneKey: "Minigame 6",
	status: "booting",
	remainingChunks: 3,
	totalChunks: 3,
	elapsedMs: 0,
	roundTimeMs: 15000,
	currentRound: 0,
	playerScore: 0,
	enemyScore: 0,
	message: "Booting Phaser bridge...",
};

const initialControls = {
	jabDisabled: true,
	hookDisabled: true,
	blockDisabled: true,
};

function formatSeconds(value: number) {
	return (value / 1000).toFixed(1);
}

export default function Minigame6Shell() {
	const [gameState, setGameState] = useState<GameStateEvent>(initialState);
	const [controls, setControls] = useState(initialControls);

	useEffect(() => {
		const unsubscribeState = gameEventBus.on(GAME_EVENTS.GAME_STATE, (payload) => {
			if (payload.sceneKey === "Minigame 6") {
				setGameState(payload);
			}
		});
		const unsubscribeControls = gameEventBus.on(GAME_EVENTS.MINIGAME6_CONTROLS, (payload) => {
			setControls(payload);
		});

		return () => {
			unsubscribeState();
			unsubscribeControls();
		};
	}, []);

	const isFinished = gameState.status === "won" || gameState.status === "lost";
	const playerScore = gameState.playerScore ?? 0;
	const enemyScore = gameState.enemyScore ?? 0;

	return (
		<>
			<div className="h-dvh overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.16),_transparent_32%),linear-gradient(180deg,#090511_0%,#04040a_100%)] px-4 py-4 pb-40 text-white sm:px-8 sm:py-6 sm:pb-48 lg:px-12">
				<main className="mx-auto flex h-full w-full max-w-5xl flex-col gap-3 sm:gap-4">
					<div className="flex items-start justify-between gap-3">
						<div>
							<p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">CYBER Minigames</p>
							<h1 className="mt-1 text-2xl font-semibold text-cyan-50 sm:mt-2 sm:text-4xl">Box-Off!</h1>
							<p className="mt-2 max-w-2xl text-xs text-slate-300 sm:text-sm">
								Win the three short rounds on damage or finish the fight with a knockout. Watch the telegraph and answer with the right button.
							</p>
						</div>
						<Link
							href="/"
							className="shrink-0 rounded-full border border-cyan-200/35 px-3 py-2 text-xs font-medium text-cyan-50 transition-colors hover:bg-cyan-100 hover:text-slate-950 sm:px-4 sm:text-sm"
						>
							Back to hub
						</Link>
					</div>

					<div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.22em] text-cyan-100/75 sm:text-xs">
						<div className="rounded-full border border-cyan-100/15 bg-black/20 px-3 py-2">Round {gameState.currentRound || 0}/3</div>
						<div className="rounded-full border border-cyan-100/15 bg-black/20 px-3 py-2">Time {formatSeconds(gameState.roundTimeMs ?? 0)}s</div>
					</div>

					<div className="relative min-h-0 flex-1">
						<PhaserGame startSceneKey="minigame6" />

						{isFinished ? (
							<div className="absolute inset-0 flex items-center justify-center rounded-[1.5rem] bg-slate-950/70 p-4 backdrop-blur-sm sm:p-6">
								<div className="w-full max-w-sm rounded-[1.75rem] border border-cyan-100/15 bg-slate-950/92 px-5 py-6 text-center shadow-[0_18px_60px_rgba(15,23,42,0.48)] sm:max-w-md sm:px-6 sm:py-7">
									<p className="text-xs uppercase tracking-[0.35em] text-cyan-100/55">Fight Over</p>
									<h2 className="mt-3 text-2xl font-semibold text-cyan-50 sm:text-3xl">
										{gameState.status === "won" ? "Hands Raised" : "Counted Out"}
									</h2>
									<p className="mt-3 text-sm text-slate-300">{gameState.message}</p>
									<p className="mt-2 text-sm text-slate-400">Final cards: {playerScore} - {enemyScore}</p>
									<div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row sm:justify-center">
										<button
											type="button"
											onClick={() => gameEventBus.emit(GAME_EVENTS.RESTART_GAME, { sceneKey: "minigame6" })}
											className="rounded-full bg-cyan-100 px-5 py-3 text-sm font-semibold text-slate-950 transition-transform hover:-translate-y-0.5"
										>
											Restart Minigame
										</button>
										<Link
											href="/"
											className="rounded-full border border-cyan-100/35 px-5 py-3 text-sm font-semibold text-cyan-50 transition-colors hover:bg-cyan-100 hover:text-slate-950"
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

			<BoxingControls disabled={controls} />
		</>
	);
}