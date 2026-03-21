"use client";

import { useEffect, useRef, useState } from "react";
import { GAME_EVENTS, gameEventBus } from "@/game/event-bus";

export default function PhaserGame() {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const gameRef = useRef<import("phaser").Game | null>(null);
	const [sceneLabel, setSceneLabel] = useState("Booting Phaser");

	useEffect(() => {
		let isMounted = true;

		const unsubscribe = gameEventBus.on(GAME_EVENTS.SCENE_READY, ({ sceneKey }) => {
			setSceneLabel(sceneKey);
		});

		const initGame = async () => {
			const [{ Game }, { createGameConfig }] = await Promise.all([
				import("phaser"),
				import("@/game/config"),
			]);

			if (!isMounted || !containerRef.current || gameRef.current) {
				return;
			}

			gameRef.current = new Game(createGameConfig(containerRef.current));
		};

		void initGame();

		return () => {
			isMounted = false;
			unsubscribe();

			if (gameRef.current) {
				gameRef.current.destroy(true);
				gameRef.current = null;
			}
		};
	}, []);

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-4 rounded-2xl border border-cyan-400/20 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
				<p>
					React bridge status: <span className="font-semibold text-cyan-200">{sceneLabel}</span>
				</p>
				<p className="text-xs uppercase tracking-[0.25em] text-cyan-300/70">Phaser Mounted</p>
			</div>
			<div className="overflow-hidden rounded-[1.5rem] border border-cyan-400/20 bg-slate-950/80 shadow-[0_18px_60px_rgba(8,145,178,0.18)]">
				<div ref={containerRef} className="aspect-video w-full" />
			</div>
		</div>
	);
}