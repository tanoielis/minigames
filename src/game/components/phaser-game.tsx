"use client";

import { useEffect, useRef } from "react";

export default function PhaserGame() {
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

			gameRef.current = new Game(createGameConfig(containerRef.current));
		};

		void initGame();

		return () => {
			isMounted = false;

			if (gameRef.current) {
				gameRef.current.destroy(true);
				gameRef.current = null;
			}
		};
	}, []);

	return (
		<div className="overflow-hidden rounded-[1.5rem] border border-cyan-400/20 bg-slate-950/80 shadow-[0_18px_60px_rgba(8,145,178,0.18)]">
			<div ref={containerRef} className="aspect-video w-full" />
		</div>
	);
}