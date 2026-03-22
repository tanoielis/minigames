"use client";

import { useEffect, useRef } from "react";
import { GAME_EVENTS, gameEventBus } from "@/game/event-bus";

export default function ActionButtonControl({ disabled, label }: { disabled: boolean; label?: string }) {
	const isPressedRef = useRef(false);

	useEffect(() => {
		if (disabled && isPressedRef.current) {
			isPressedRef.current = false;
			gameEventBus.emit(GAME_EVENTS.ACTION_PRESS, { active: false });
		}
	}, [disabled]);

	useEffect(() => {
		const release = () => {
			if (!isPressedRef.current) {
				return;
			}

			isPressedRef.current = false;
			gameEventBus.emit(GAME_EVENTS.ACTION_PRESS, { active: false });
		};

		window.addEventListener("pointerup", release);
		window.addEventListener("pointercancel", release);

		return () => {
			window.removeEventListener("pointerup", release);
			window.removeEventListener("pointercancel", release);
		};
	}, []);

	const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
		if (disabled) {
			return;
		}

		event.preventDefault();
		isPressedRef.current = true;
		gameEventBus.emit(GAME_EVENTS.ACTION_PRESS, { active: true });
	};

	const handleContextMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
		event.preventDefault();
	};

	const handlePointerUp = () => {
		if (!isPressedRef.current) {
			return;
		}

		isPressedRef.current = false;
		gameEventBus.emit(GAME_EVENTS.ACTION_PRESS, { active: false });
	};

	return (
		<div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center px-4 sm:bottom-8 sm:px-6">
			<div className="flex flex-col items-center gap-3">
				<p className="text-[10px] uppercase tracking-[0.35em] text-cyan-200/70 sm:text-xs">Action</p>
				<button
					type="button"
					onPointerDown={handlePointerDown}
					onPointerUp={handlePointerUp}
					onPointerLeave={handlePointerUp}
					onContextMenu={handleContextMenu}
					disabled={disabled}
					className="pointer-events-auto flex h-24 w-24 items-center justify-center rounded-full border border-cyan-100/25 bg-cyan-300/90 text-sm font-black uppercase tracking-[0.22em] text-slate-950 shadow-[0_0_40px_rgba(34,211,238,0.3)] transition-transform active:scale-95 disabled:cursor-default disabled:border-cyan-200/15 disabled:bg-slate-700/60 disabled:text-slate-300 sm:h-28 sm:w-28 sm:text-base"
					style={{
						WebkitTouchCallout: "none",
						WebkitUserSelect: "none",
						userSelect: "none",
					}}
				>
					{label ?? "Jump"}
				</button>
			</div>
		</div>
	);
}