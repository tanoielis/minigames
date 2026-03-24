"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ActionButtonControl from "@/game/components/action-button-control";
import PhaserGame from "@/game/components/phaser-game";
import { GAME_EVENTS, gameEventBus, type GameStateEvent } from "@/game/event-bus";
import { createShuffleHref, pickRandomMinigame } from "@/game/shuffle";

const initialState: GameStateEvent = {
	sceneKey: "Minigame 4",
	status: "booting",
	remainingChunks: 24,
	totalChunks: 24,
	elapsedMs: 0,
	message: "Booting Phaser bridge...",
};

function formatSeconds(value: number) {
	return (value / 1000).toFixed(1);
}

export default function Minigame4Shell({ shuffleMode = false }: { shuffleMode?: boolean }) {
	const pathname = usePathname();
	const router = useRouter();
	const isRouteActive = pathname === "/minigame4";
	const [gameState, setGameState] = useState<GameStateEvent>(initialState);
	const [sessionKey, setSessionKey] = useState(0);
	const activeInstanceIdRef = useRef<string | null>(null);

	useEffect(() => {
		if (isRouteActive) {
			activeInstanceIdRef.current = null;
			setGameState(initialState);
			setSessionKey((current) => current + 1);
			return;
		}

		activeInstanceIdRef.current = null;
		setGameState(initialState);
	}, [isRouteActive, pathname]);

	useEffect(() => {
		activeInstanceIdRef.current = null;
		setGameState(initialState);

		const unsubscribeState = gameEventBus.on(GAME_EVENTS.GAME_STATE, (payload) => {
			if (payload.sceneKey === "Minigame 4" && payload.instanceId === activeInstanceIdRef.current) {
				setGameState(payload);
			}
		});
		const unsubscribeReady = gameEventBus.on(GAME_EVENTS.SCENE_READY, ({ sceneKey, instanceId }) => {
			if (sceneKey === "Minigame 4") {
				activeInstanceIdRef.current = instanceId ?? null;
				setGameState(initialState);
			}
		});

		return () => {
			unsubscribeState();
			unsubscribeReady();
		};
	}, []);

	const isFinished = gameState.status === "won" || gameState.status === "lost";
	const isShuffleRun = shuffleMode;

	return (
		<>
			<div className="h-dvh overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.14),_transparent_34%),linear-gradient(180deg,#090b14_0%,#03050a_100%)] px-4 py-4 pb-40 text-white sm:px-8 sm:py-6 sm:pb-48 lg:px-12">
				<main className="mx-auto flex h-full w-full max-w-5xl flex-col gap-3 sm:gap-4">
					<div className="flex items-start justify-between gap-3">
						<div>
							<p className="text-xs uppercase tracking-[0.3em] text-cyan-300/70">CYBER Minigames</p>
							<h1 className="mt-1 text-2xl font-semibold text-cyan-100 sm:mt-2 sm:text-4xl">Neon Rider</h1>
							<p className="mt-2 max-w-2xl text-xs text-slate-300 sm:text-sm">
								Traffic floods down a three-lane neon highway. Tap the action button to flip your drift and survive for twenty seconds.
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
						{isRouteActive ? <PhaserGame key={sessionKey} startSceneKey="minigame4" /> : null}

						{isFinished ? (
							<div className="absolute inset-0 flex items-center justify-center rounded-[1.5rem] bg-slate-950/72 p-4 backdrop-blur-sm sm:p-6">
								<div className="w-full max-w-sm rounded-[1.75rem] border border-cyan-300/25 bg-slate-950/92 px-5 py-6 text-center shadow-[0_18px_60px_rgba(34,211,238,0.12)] sm:max-w-md sm:px-6 sm:py-7">
									<p className="text-xs uppercase tracking-[0.35em] text-cyan-300/70">Game Over</p>
									<h2 className="mt-3 text-2xl font-semibold text-cyan-100 sm:text-3xl">
										{gameState.status === "won" ? "Traffic Split" : "Wipeout"}
									</h2>
									<p className="mt-3 text-sm text-slate-300">{gameState.message}</p>
									<p className="mt-2 text-sm text-slate-400">Ride time: {formatSeconds(gameState.elapsedMs)}s</p>
									<div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row sm:justify-center">
										{isShuffleRun ? (
											<button
												type="button"
												onClick={() => router.push(createShuffleHref(pickRandomMinigame("minigame4")))}
												className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition-transform hover:-translate-y-0.5"
											>
												Next Game
											</button>
										) : (
											<button
												type="button"
												onClick={() => gameEventBus.emit(GAME_EVENTS.RESTART_GAME, { sceneKey: "minigame4" })}
												className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition-transform hover:-translate-y-0.5"
											>
												Restart Minigame
											</button>
										)}
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

			<ActionButtonControl disabled={!isRouteActive || isFinished || gameState.status === "booting"} label="Action" />
		</>
	);
}