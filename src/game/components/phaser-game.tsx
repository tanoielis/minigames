"use client";

import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

export default function PhaserGame({ startSceneKey, children }: { startSceneKey: string; children?: ReactNode }) {
	const frameRef = useRef<HTMLDivElement | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const gameRef = useRef<import("phaser").Game | null>(null);
	const [overlayStyle, setOverlayStyle] = useState<CSSProperties>({
		left: 0,
		top: 0,
		width: "100%",
		height: "100%",
	});

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

	useEffect(() => {
		const syncOverlayBounds = () => {
			if (!frameRef.current || !containerRef.current) {
				return;
			}

			const canvas = containerRef.current.querySelector("canvas");
			if (!(canvas instanceof HTMLCanvasElement)) {
				setOverlayStyle({ left: 0, top: 0, width: "100%", height: "100%" });
				return;
			}

			const frameRect = frameRef.current.getBoundingClientRect();
			const canvasRect = canvas.getBoundingClientRect();

			setOverlayStyle({
				left: canvasRect.left - frameRect.left,
				top: canvasRect.top - frameRect.top,
				width: canvasRect.width,
				height: canvasRect.height,
			});
		};

		syncOverlayBounds();

		const resizeObserver = new ResizeObserver(() => {
			syncOverlayBounds();
		});

		if (frameRef.current) {
			resizeObserver.observe(frameRef.current);
		}

		if (containerRef.current) {
			resizeObserver.observe(containerRef.current);
		}

		const mutationObserver = new MutationObserver(() => {
			syncOverlayBounds();
			const canvas = containerRef.current?.querySelector("canvas");
			if (canvas instanceof HTMLCanvasElement) {
				resizeObserver.observe(canvas);
			}
		});

		if (containerRef.current) {
			mutationObserver.observe(containerRef.current, { childList: true, subtree: true });
		}

		window.addEventListener("resize", syncOverlayBounds);

		return () => {
			window.removeEventListener("resize", syncOverlayBounds);
			mutationObserver.disconnect();
			resizeObserver.disconnect();
		};
	}, [startSceneKey]);

	return (
		<div className="flex h-full items-center justify-center">
			<div
				ref={frameRef}
				className="relative aspect-video h-full max-h-full w-full overflow-hidden rounded-[1.5rem] border border-cyan-400/20 bg-slate-950/80 shadow-[0_18px_60px_rgba(8,145,178,0.18)]"
			>
				<div ref={containerRef} className="h-full w-full" />
				<div className="pointer-events-none absolute" style={overlayStyle}>
					{children}
				</div>
			</div>
		</div>
	);
}