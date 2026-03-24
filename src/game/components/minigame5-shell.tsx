"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PhaserGame from "@/game/components/phaser-game";
import JoystickControl from "@/game/components/joystick-control";
import { GAME_EVENTS, gameEventBus, type GameStateEvent } from "@/game/event-bus";

const initialState: GameStateEvent = {
	sceneKey: "Minigame 5",
	status: "booting",
	remainingChunks: 3,
	totalChunks: 3,
	elapsedMs: 0,
	currentRound: 0,
	playerScore: 0,
	enemyScore: 0,
	message: "Booting Phaser bridge...",
};

export default function Minigame5Shell() {
	const [gameState, setGameState] = useState<GameStateEvent>(initialState);

	useEffect(() => {
		const unsubscribe = gameEventBus.on(GAME_EVENTS.GAME_STATE, (payload) => {
			if (payload.sceneKey === "Minigame 5") {
				setGameState(payload);
			}
		});

		return unsubscribe;
	}, []);

	const isFinished = gameState.status === "won" || gameState.status === "lost";
	const playerScore = gameState.playerScore ?? 0;
	const enemyScore = gameState.enemyScore ?? 0;

	return (
		<>
			<div className="h-dvh overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,221,170,0.2),_transparent_32%),linear-gradient(180deg,#26160d_0%,#100804_100%)] px-4 py-4 pb-40 text-white sm:px-8 sm:py-6 sm:pb-48 lg:px-12">
				<main className="mx-auto flex h-full w-full max-w-5xl flex-col gap-3 sm:gap-4">
					<div className="flex items-start justify-between gap-3">
						<div>
							<p className="text-xs uppercase tracking-[0.3em] text-amber-200/70">CYBER Minigames</p>
							<h1 className="mt-1 text-2xl font-semibold text-amber-50 sm:mt-2 sm:text-4xl">Joust Royale</h1>
							<p className="mt-2 max-w-2xl text-xs text-amber-50/75 sm:text-sm">
								Use the joystick to keep your lance marker on target while the rival knight charges in. Three passes decide the match unless someone lands a perfect strike.
							</p>
						</div>
						<Link
							href="/"
							className="shrink-0 rounded-full border border-amber-100/35 px-3 py-2 text-xs font-medium text-amber-50 transition-colors hover:bg-amber-100 hover:text-stone-950 sm:px-4 sm:text-sm"
						>
							Back to Menu
						</Link>
					</div>

					<div className="relative min-h-0 flex-1">
						<PhaserGame startSceneKey="minigame5" />

						<div className="pointer-events-none absolute left-4 top-4 max-w-md rounded-[1.25rem] border border-amber-100/15 bg-stone-950/55 px-4 py-3 text-sm text-amber-50/85 backdrop-blur-sm">
							{gameState.message}
						</div>

						{isFinished ? (
							<div className="absolute inset-0 flex items-center justify-center rounded-[1.5rem] bg-stone-950/68 p-4 backdrop-blur-sm sm:p-6">
								<div className="w-full max-w-sm rounded-[1.75rem] border border-amber-100/20 bg-stone-950/92 px-5 py-6 text-center shadow-[0_18px_60px_rgba(120,53,15,0.28)] sm:max-w-md sm:px-6 sm:py-7">
									<p className="text-xs uppercase tracking-[0.35em] text-amber-100/60">Game Over</p>
									<h2 className="mt-3 text-2xl font-semibold text-amber-50 sm:text-3xl">
										{gameState.status === "won" ? "Tilt Won" : "Unhorsed"}
									</h2>
									<p className="mt-3 text-sm text-amber-50/78">{gameState.message}</p>
									<p className="mt-2 text-sm text-amber-100/60">Final score: {playerScore} - {enemyScore}</p>
									<div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row sm:justify-center">
										<button
											type="button"
											onClick={() => gameEventBus.emit(GAME_EVENTS.RESTART_GAME, { sceneKey: "minigame5" })}
											className="rounded-full bg-amber-100 px-5 py-3 text-sm font-semibold text-stone-950 transition-transform hover:-translate-y-0.5"
										>
											Restart Minigame
										</button>
										<Link
											href="/"
											className="rounded-full border border-amber-100/35 px-5 py-3 text-sm font-semibold text-amber-50 transition-colors hover:bg-amber-100 hover:text-stone-950"
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