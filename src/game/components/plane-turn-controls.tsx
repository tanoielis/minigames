"use client";

import { useEffect, useRef, useState } from "react";
import { GAME_EVENTS, gameEventBus } from "@/game/event-bus";

type TurnState = {
	left: boolean;
	right: boolean;
};

export default function PlaneTurnControls({ disabled, boostDisabled }: { disabled: boolean; boostDisabled: boolean }) {
	const leftPointerIdRef = useRef<number | null>(null);
	const rightPointerIdRef = useRef<number | null>(null);
	const [turnState, setTurnState] = useState<TurnState>({ left: false, right: false });

	useEffect(() => {
		if (!disabled) {
			return;
		}

		leftPointerIdRef.current = null;
		rightPointerIdRef.current = null;
		setTurnState({ left: false, right: false });
		gameEventBus.emit(GAME_EVENTS.MINIGAME7_TURN, { left: false, right: false });
	}, [disabled]);

	useEffect(() => {
		const releasePointer = (pointerId: number) => {
			let changed = false;
			const nextState = { ...turnState };

			if (leftPointerIdRef.current === pointerId) {
				leftPointerIdRef.current = null;
				nextState.left = false;
				changed = true;
			}

			if (rightPointerIdRef.current === pointerId) {
				rightPointerIdRef.current = null;
				nextState.right = false;
				changed = true;
			}

			if (!changed) {
				return;
			}

			setTurnState(nextState);
			gameEventBus.emit(GAME_EVENTS.MINIGAME7_TURN, nextState);
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
	}, [turnState]);

	const press = (direction: keyof TurnState) => (event: React.PointerEvent<HTMLButtonElement>) => {
		if (disabled) {
			return;
		}

		event.preventDefault();
		const nextState = {
			left: direction === "left" ? true : turnState.left,
			right: direction === "right" ? true : turnState.right,
		};

		if (direction === "left") {
			leftPointerIdRef.current = event.pointerId;
		} else {
			rightPointerIdRef.current = event.pointerId;
		}

		setTurnState(nextState);
		gameEventBus.emit(GAME_EVENTS.MINIGAME7_TURN, nextState);
	};

	const release = (direction: keyof TurnState) => () => {
		const pointerId = direction === "left" ? leftPointerIdRef.current : rightPointerIdRef.current;
		if (pointerId === null) {
			return;
		}

		if (direction === "left") {
			leftPointerIdRef.current = null;
		} else {
			rightPointerIdRef.current = null;
		}

		const nextState = {
			left: direction === "left" ? false : turnState.left,
			right: direction === "right" ? false : turnState.right,
		};

		setTurnState(nextState);
		gameEventBus.emit(GAME_EVENTS.MINIGAME7_TURN, nextState);
	};

	const buttonClass = (isDisabled: boolean, accent: string) =>
		`pointer-events-auto flex h-24 w-24 items-center justify-center rounded-[1.3rem] border px-5 py-4 text-sm font-black uppercase tracking-[0.22em] shadow-[0_18px_40px_rgba(15,23,42,0.22)] transition-transform active:scale-95 sm:h-28 sm:w-28 sm:text-base ${isDisabled ? "border-slate-200/10 bg-slate-800/65 text-slate-400" : accent}`;

	const handleBoost = (event: React.PointerEvent<HTMLButtonElement>) => {
		if (disabled || boostDisabled) {
			return;
		}

		event.preventDefault();
		gameEventBus.emit(GAME_EVENTS.MINIGAME7_BOOST, { active: true });
	};

	return (
		<div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 sm:bottom-8 sm:px-6">
			<div className="pointer-events-auto flex w-full max-w-md flex-col items-center gap-3 rounded-[1.6rem] border border-sky-100/12 bg-slate-950/72 p-3 shadow-[0_20px_60px_rgba(15,23,42,0.38)] backdrop-blur-sm">
				<p className="text-[10px] uppercase tracking-[0.35em] text-sky-100/65 sm:text-xs">Turn</p>
				<div className="flex w-full gap-3">
					<button
						type="button"
						onPointerDown={press("left")}
						onPointerUp={release("left")}
						onPointerLeave={release("left")}
						aria-disabled={disabled}
						className={buttonClass(disabled, "border-sky-200/30 bg-sky-200 text-slate-950")}
						style={{
							WebkitTouchCallout: "none",
							WebkitUserSelect: "none",
							userSelect: "none",
						}}
					>
						Left
					</button>
					<button
						type="button"
						onPointerDown={handleBoost}
						aria-disabled={disabled || boostDisabled}
						className={buttonClass(disabled || boostDisabled, "border-amber-200/30 bg-amber-200 text-slate-950")}
						style={{
							WebkitTouchCallout: "none",
							WebkitUserSelect: "none",
							userSelect: "none",
						}}
					>
						Boost
					</button>
					<button
						type="button"
						onPointerDown={press("right")}
						onPointerUp={release("right")}
						onPointerLeave={release("right")}
						aria-disabled={disabled}
						className={buttonClass(disabled, "border-cyan-200/30 bg-cyan-300 text-slate-950")}
						style={{
							WebkitTouchCallout: "none",
							WebkitUserSelect: "none",
							userSelect: "none",
						}}
					>
						Right
					</button>
				</div>
			</div>
		</div>
	);
}