"use client";

import { useEffect, useRef } from "react";

export default function PhaserGame({ startSceneKey }: { startSceneKey: string }) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const gameRef = useRef<import("phaser").Game | null>(null);

	useEffect(() => {
		let isMounted = true;

		const initGame = async () => {
			const [{ Game }, { createGameConfig }] = await Promise.all([
				import("phaser"),
				import("@/game/config"),
			]);

			if (!isMounted || !containerRef.current || gameRef.current) {
				return;
			}

			gameRef.current = new Game(createGameConfig(containerRef.current, startSceneKey));
		};

		void initGame();

		return () => {
			isMounted = false;

			if (gameRef.current) {
				gameRef.current.destroy(true);
				gameRef.current = null;
			}
		};
	}, [startSceneKey]);

	return (
		<div className="h-full overflow-hidden rounded-[1.5rem] border border-cyan-400/20 bg-slate-950/80 shadow-[0_18px_60px_rgba(8,145,178,0.18)]">
			<div ref={containerRef} className="h-full w-full" />
		</div>
	);
}