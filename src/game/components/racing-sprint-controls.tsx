"use client";

import { useEffect, useRef, useState } from "react";
import { GAME_EVENTS, gameEventBus } from "@/game/event-bus";

type RacingControlsState = {
	accelerateDisabled: boolean;
	shiftDisabled: boolean;
};

export default function RacingSprintControls({ disabled }: { disabled: RacingControlsState }) {
	const pointerIdRef = useRef<number | null>(null);
	const [acceleratePressed, setAcceleratePressed] = useState(false);

	useEffect(() => {
		if (!disabled.accelerateDisabled) {
			return;
		}

		pointerIdRef.current = null;
		setAcceleratePressed(false);
		gameEventBus.emit(GAME_EVENTS.MINIGAME10_THROTTLE, { active: false });
	}, [disabled.accelerateDisabled]);

	useEffect(() => {
		const releasePointer = (pointerId: number) => {
			if (pointerIdRef.current !== pointerId) {
				return;
			}

			pointerIdRef.current = null;
			setAcceleratePressed(false);
			gameEventBus.emit(GAME_EVENTS.MINIGAME10_THROTTLE, { active: false });
		};

		const handlePointerUp = (event: PointerEvent) => {
			releasePointer(event.pointerId);
		};

		window.addEventListener("pointerup", handlePointerUp);
		window.addEventListener("pointercancel", handlePointerUp);

		return () => {
			window.removeEventListener("pointerup", handlePointerUp);
			window.removeEventListener("pointercancel", handlePointerUp);
		};
	}, []);

	const handleAccelerateDown = (event: React.PointerEvent<HTMLButtonElement>) => {
		if (disabled.accelerateDisabled) {
			return;
		}

		event.preventDefault();
		pointerIdRef.current = event.pointerId;
		setAcceleratePressed(true);
		gameEventBus.emit(GAME_EVENTS.MINIGAME10_THROTTLE, { active: true });
	};

	const handleAccelerateUp = () => {
		if (pointerIdRef.current === null) {
			return;
		}

		pointerIdRef.current = null;
		setAcceleratePressed(false);
		gameEventBus.emit(GAME_EVENTS.MINIGAME10_THROTTLE, { active: false });
	};

	const handleShift = (event: React.PointerEvent<HTMLButtonElement>) => {
		if (disabled.shiftDisabled || acceleratePressed) {
			return;
		}

		event.preventDefault();
		gameEventBus.emit(GAME_EVENTS.MINIGAME10_SHIFT, { triggered: true });
	};

	const preventContextMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
		event.preventDefault();
	};

	const accelerateClass = disabled.accelerateDisabled
		? "border-slate-200/10 bg-slate-800/65 text-slate-400"
		: "border-amber-200/30 bg-amber-200 text-slate-950";
	const shiftDisabled = disabled.shiftDisabled || acceleratePressed;
	const shiftClass = shiftDisabled
		? "border-slate-200/10 bg-slate-800/65 text-slate-400"
		: "border-cyan-200/30 bg-cyan-300 text-slate-950";

	return (
		<div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 sm:bottom-8 sm:px-6">
			<div className="pointer-events-auto flex w-full max-w-md gap-3 rounded-[1.6rem] border border-amber-100/12 bg-slate-950/72 p-3 shadow-[0_20px_60px_rgba(15,23,42,0.38)] backdrop-blur-sm sm:p-4">
				<button
					type="button"
					onPointerDown={handleAccelerateDown}
					onPointerUp={handleAccelerateUp}
					onPointerLeave={handleAccelerateUp}
					onContextMenu={preventContextMenu}
					disabled={disabled.accelerateDisabled}
					className={`flex-1 rounded-[1.25rem] border px-4 py-5 text-sm font-black uppercase tracking-[0.18em] transition-transform active:scale-95 sm:text-base ${accelerateClass}`}
					style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}
				>
					Accelerate
				</button>
				<button
					type="button"
					onPointerDown={handleShift}
					onContextMenu={preventContextMenu}
					disabled={shiftDisabled}
					className={`flex-1 rounded-[1.25rem] border px-4 py-5 text-sm font-black uppercase tracking-[0.18em] transition-transform active:scale-95 sm:text-base ${shiftClass}`}
					style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}
				>
					Shift Up
				</button>
			</div>
		</div>
	);
}