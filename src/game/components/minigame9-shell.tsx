"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PhaserGame from "@/game/components/phaser-game";
import { GAME_EVENTS, gameEventBus, type GameStateEvent } from "@/game/event-bus";

const initialState: GameStateEvent = {
	sceneKey: "Minigame 9",
	status: "booting",
	remainingChunks: 0,
	totalChunks: 0,
	elapsedMs: 0,
	message: "Booting Phaser bridge...",
};

export default function Minigame9Shell() {
	const [gameState, setGameState] = useState<GameStateEvent>(initialState);

	useEffect(() => {
		const unsubscribe = gameEventBus.on(GAME_EVENTS.GAME_STATE, (payload) => {
			if (payload.sceneKey === "Minigame 9") {
				setGameState(payload);
			}
		});

		return unsubscribe;
	}, []);

	const isFinished = gameState.status === "won" || gameState.status === "lost";

	const sendAction = (action: "deal" | "hit" | "stand") => {
		gameEventBus.emit(GAME_EVENTS.MINIGAME9_ACTION, { action });
	};

	return (
		<>
			<div className="h-dvh overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(38,41,52,0.4),_transparent_32%),linear-gradient(180deg,#0c111c_0%,#070a11_100%)] px-4 py-4 pb-44 text-white sm:px-8 sm:py-6 sm:pb-52 lg:px-12">
				<main className="mx-auto flex h-full w-full max-w-5xl flex-col gap-4">
					<div className="flex items-start justify-between gap-3">
						<div>
							<p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">CYBER Minigames</p>
							<h1 className="mt-1 text-2xl font-semibold text-emerald-100 sm:mt-2 sm:text-4xl">Blackjack</h1>
							<p className="mt-2 max-w-2xl text-xs text-slate-300 sm:text-sm">
								Deal cards, Hit to take another, Stand to lock your total. Beat the dealer without busting.
							</p>
						</div>
						<Link
							href="/"
							className="shrink-0 rounded-full border border-emerald-200/40 px-3 py-2 text-xs font-medium text-emerald-100 transition-colors hover:bg-emerald-200 hover:text-slate-950 sm:px-4 sm:text-sm"
						>
							Back to Menu
						</Link>
					</div>

					<div className="rounded-[1.25rem] border border-emerald-100/20 bg-slate-950/70 p-4 text-sm text-emerald-100">
						<p className="font-semibold">{gameState.message}</p>
						<p className="text-emerald-50/80">Game state: {gameState.status.toUpperCase()}</p>
					</div>

					<PhaserGame startSceneKey="minigame9" />

					<div className="grid grid-cols-3 gap-3">
						<button
							type="button"
							onClick={() => sendAction("deal")}
							className="rounded-full border border-emerald-100/30 bg-emerald-300/95 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5"
						>
							Deal
						</button>
						<button
							type="button"
							onClick={() => sendAction("hit")}
							disabled={isFinished || gameState.status === "booting"}
							className="rounded-full border border-emerald-100/30 bg-cyan-300/90 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
						>
							Hit
						</button>
						<button
							type="button"
							onClick={() => sendAction("stand")}
							disabled={isFinished || gameState.status === "booting"}
							className="rounded-full border border-emerald-100/30 bg-amber-300/95 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
						>
							Stand
						</button>
					</div>
				</main>
			</div>
			{isFinished ? (
				<div className="pointer-events-none fixed inset-x-0 bottom-24 flex justify-center p-4"> 
					<button
						type="button"
						onClick={() => sendAction("deal")}
						className="pointer-events-auto rounded-full bg-emerald-300 px-6 py-3 text-sm font-bold text-slate-950"
					>
						New Hand
					</button>
				</div>
			) : null}
		</>
	);
}
