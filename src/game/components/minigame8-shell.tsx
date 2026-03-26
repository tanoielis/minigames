"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CoffeeChaosControls from "@/game/components/coffee-chaos-controls";
import PhaserGame from "@/game/components/phaser-game";
import { GAME_EVENTS, gameEventBus, type GameStateEvent } from "@/game/event-bus";
import { createShuffleHref, pickRandomMinigame } from "@/game/shuffle";

const initialState: GameStateEvent = {
	sceneKey: "Minigame 8",
	status: "booting",
	remainingChunks: 0,
	totalChunks: 0,
	elapsedMs: 0,
	playerScore: 0,
	enemyScore: 0,
	message: "Booting coffee station...",
};

const initialControls = {
	smallCupDisabled: true,
	largeCupDisabled: true,
	regularMilkDisabled: true,
	oatMilkDisabled: true,
	pullLeftDisabled: true,
	pullRightDisabled: true,
	pourMilkDisabled: true,
	chocolateDisabled: true,
	cinnamonDisabled: true,
};

function formatSeconds(value: number) {
	return Math.max(0, value / 1000).toFixed(1);
}

export default function Minigame8Shell({ shuffleMode = false }: { shuffleMode?: boolean }) {
	const router = useRouter();
	const [gameState, setGameState] = useState<GameStateEvent>(initialState);
	const [controls, setControls] = useState(initialControls);

	useEffect(() => {
		const unsubscribeState = gameEventBus.on(GAME_EVENTS.GAME_STATE, (payload) => {
			if (payload.sceneKey === "Minigame 8") {
				setGameState(payload);
			}
		});
		const unsubscribeControls = gameEventBus.on(GAME_EVENTS.MINIGAME8_CONTROLS, (payload) => {
			setControls(payload);
		});

		return () => {
			unsubscribeState();
			unsubscribeControls();
		};
	}, []);

	const isFinished = gameState.status === "won" || gameState.status === "lost";
	const completedOrders = gameState.playerScore ?? 0;
	const penalties = gameState.enemyScore ?? 0;
	const timeLeftMs = Math.max(0, 60_000 - gameState.elapsedMs);

	return (
		<>
			<div className="h-dvh overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.14),_transparent_30%),radial-gradient(circle_at_78%_18%,_rgba(249,115,22,0.14),_transparent_26%),linear-gradient(180deg,#20140d_0%,#0d0907_100%)] px-4 py-4 pb-44 text-white sm:px-8 sm:py-6 sm:pb-52 lg:px-12">
				<main className="mx-auto flex h-full w-full max-w-5xl flex-col gap-3 sm:gap-4">
					<div className="flex items-start justify-between gap-3">
						<div>
							<p className="text-xs uppercase tracking-[0.3em] text-amber-200/70">CYBER Minigames</p>
							<h1 className="mt-1 text-2xl font-semibold text-amber-50 sm:mt-2 sm:text-4xl">Coffee Chaos</h1>
							<p className="mt-2 max-w-2xl text-xs text-amber-50/80 sm:text-sm">
								Brew cups under either head, steam one jug at a time, top the selected bench drink, and survive the full rush without taking 3 penalties.
							</p>
						</div>
						<Link
							href="/"
							className="shrink-0 rounded-full border border-amber-100/35 px-3 py-2 text-xs font-medium text-amber-50 transition-colors hover:bg-amber-100 hover:text-stone-950 sm:px-4 sm:text-sm"
						>
							Back to Menu
						</Link>
					</div>

					<div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.22em] text-amber-100/75 sm:text-xs">
						<div className="rounded-full border border-amber-100/15 bg-black/20 px-3 py-2">Orders {completedOrders}</div>
						<div className="rounded-full border border-amber-100/15 bg-black/20 px-3 py-2">Penalties {penalties}/3</div>
						<div className="rounded-full border border-amber-100/15 bg-black/20 px-3 py-2">{formatSeconds(timeLeftMs)}s</div>
					</div>

					<div className="relative min-h-0 flex-1">
						<PhaserGame startSceneKey="minigame8" />

						{isFinished ? (
							<div className="absolute inset-0 flex items-center justify-center rounded-[1.5rem] bg-stone-950/70 p-4 backdrop-blur-sm sm:p-6">
								<div className="w-full max-w-sm rounded-[1.75rem] border border-amber-100/20 bg-stone-950/92 px-5 py-6 text-center shadow-[0_18px_60px_rgba(120,53,15,0.28)] sm:max-w-md sm:px-6 sm:py-7">
									<p className="text-xs uppercase tracking-[0.35em] text-amber-100/60">Rush Over</p>
									<h2 className="mt-3 text-2xl font-semibold text-amber-50 sm:text-3xl">
										{gameState.status === "won" ? "Cafe Saved" : "Service Collapsed"}
									</h2>
									<p className="mt-3 text-sm text-amber-50/78">{gameState.message}</p>
									<p className="mt-2 text-sm text-amber-100/60">Completed {completedOrders} orders with {penalties} penalties.</p>
									<div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row sm:justify-center">
										{shuffleMode ? (
											<button
												type="button"
												onClick={() => router.push(createShuffleHref(pickRandomMinigame("minigame8")))}
												className="rounded-full bg-amber-100 px-5 py-3 text-sm font-semibold text-stone-950 transition-transform hover:-translate-y-0.5"
											>
												Next Game
											</button>
										) : (
											<button
												type="button"
												onClick={() => gameEventBus.emit(GAME_EVENTS.RESTART_GAME, { sceneKey: "minigame8" })}
												className="rounded-full bg-amber-100 px-5 py-3 text-sm font-semibold text-stone-950 transition-transform hover:-translate-y-0.5"
											>
												Restart Minigame
											</button>
										)}
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

			<CoffeeChaosControls disabled={controls} />
		</>
	);
}
