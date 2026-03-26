"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PhaserGame from "@/game/components/phaser-game";
import RacingSprintControls from "@/game/components/racing-sprint-controls";
import { GAME_EVENTS, gameEventBus, type GameStateEvent } from "@/game/event-bus";
import { createShuffleHref, pickRandomMinigame } from "@/game/shuffle";

const initialState: GameStateEvent = {
	sceneKey: "Minigame 10",
	status: "booting",
	remainingChunks: 0,
	totalChunks: 0,
	elapsedMs: 0,
	message: "Booting street sprint...",
};

const initialControls = {
	accelerateDisabled: true,
	shiftDisabled: true,
};

export default function Minigame10Shell({ shuffleMode = false }: { shuffleMode?: boolean }) {
	const router = useRouter();
	const [gameState, setGameState] = useState<GameStateEvent>(initialState);
	const [controls, setControls] = useState(initialControls);

	useEffect(() => {
		const unsubscribeState = gameEventBus.on(GAME_EVENTS.GAME_STATE, (payload) => {
			if (payload.sceneKey === "Minigame 10") {
				setGameState(payload);
			}
		});
		const unsubscribeControls = gameEventBus.on(GAME_EVENTS.MINIGAME10_CONTROLS, (payload) => {
			setControls(payload);
		});

		return () => {
			unsubscribeState();
			unsubscribeControls();
		};
	}, []);

	const isFinished = gameState.status === "won" || gameState.status === "lost";

	return (
		<>
			<div className="h-dvh overflow-hidden bg-[linear-gradient(180deg,#070d18_0%,#090814_100%)] px-4 py-4 pb-40 text-white sm:px-8 sm:py-6 sm:pb-48 lg:px-12">
				<main className="mx-auto flex h-full w-full max-w-5xl flex-col gap-3 sm:gap-4">
					<div className="flex items-start justify-between gap-3">
						<div>
							<p className="text-xs uppercase tracking-[0.3em] text-orange-200/70">CYBER Minigames</p>
							<h1 className="mt-1 text-2xl font-semibold text-orange-50 sm:mt-2 sm:text-4xl">Street Sprint</h1>
						</div>
						<Link
							href="/"
							className="shrink-0 rounded-full border border-orange-100/35 px-3 py-2 text-xs font-medium text-orange-50 transition-colors hover:bg-orange-100 hover:text-stone-950 sm:px-4 sm:text-sm"
						>
							Back to Menu
						</Link>
					</div>

					<div className="relative min-h-0 flex-1">
						<PhaserGame startSceneKey="minigame10" />

						{isFinished ? (
							<div className="absolute inset-0 flex items-center justify-center rounded-[1.5rem] bg-slate-950/68 p-4 backdrop-blur-sm sm:p-6">
								<div className="w-full max-w-sm rounded-[1.75rem] border border-orange-100/20 bg-slate-950/92 px-5 py-6 text-center shadow-[0_18px_60px_rgba(124,45,18,0.32)] sm:max-w-md sm:px-6 sm:py-7">
									<p className="text-xs uppercase tracking-[0.35em] text-orange-100/60">Race Over</p>
									<h2 className="mt-3 text-2xl font-semibold text-orange-50 sm:text-3xl">
										{gameState.status === "won" ? "Photo Finish" : "Outrun"}
									</h2>
									<p className="mt-3 text-sm text-orange-50/80">{gameState.message}</p>
									<div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row sm:justify-center">
										{shuffleMode ? (
											<button
												type="button"
												onClick={() => router.push(createShuffleHref(pickRandomMinigame("minigame10")))}
												className="rounded-full bg-orange-100 px-5 py-3 text-sm font-semibold text-stone-950 transition-transform hover:-translate-y-0.5"
											>
												Next Game
											</button>
										) : (
											<button
												type="button"
												onClick={() => gameEventBus.emit(GAME_EVENTS.RESTART_GAME, { sceneKey: "minigame10" })}
												className="rounded-full bg-orange-100 px-5 py-3 text-sm font-semibold text-stone-950 transition-transform hover:-translate-y-0.5"
											>
												Restart Minigame
											</button>
										)}
										<Link
											href="/"
											className="rounded-full border border-orange-100/35 px-5 py-3 text-sm font-semibold text-orange-50 transition-colors hover:bg-orange-100 hover:text-stone-950"
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

			<RacingSprintControls disabled={controls} />
		</>
	);
}