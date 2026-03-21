"use client";

import { useEffect, useRef, useState } from "react";
import { GAME_EVENTS, gameEventBus } from "@/game/event-bus";

const PAD_SIZE = 160;
const THUMB_SIZE = 64;
const MAX_RADIUS = 52;

function clampThumbPosition(dx: number, dy: number) {
	const distance = Math.hypot(dx, dy);

	if (distance <= MAX_RADIUS || distance === 0) {
		return { x: dx, y: dy };
	}

	const scale = MAX_RADIUS / distance;
	return {
		x: dx * scale,
		y: dy * scale,
	};
}

export default function JoystickControl({ disabled }: { disabled: boolean }) {
	const padRef = useRef<HTMLDivElement | null>(null);
	const activePointerRef = useRef<number | null>(null);
	const [thumbPosition, setThumbPosition] = useState({ x: 0, y: 0 });

	useEffect(() => {
		if (disabled) {
			setThumbPosition({ x: 0, y: 0 });
			gameEventBus.emit(GAME_EVENTS.INPUT_MOVE, { x: 0, y: 0, active: false });
		}
	}, [disabled]);

	useEffect(() => {
		const handlePointerMove = (event: PointerEvent) => {
			if (disabled || activePointerRef.current !== event.pointerId || !padRef.current) {
				return;
			}

			event.preventDefault();

			const rect = padRef.current.getBoundingClientRect();
			const centerX = rect.left + rect.width / 2;
			const centerY = rect.top + rect.height / 2;
			const next = clampThumbPosition(event.clientX - centerX, event.clientY - centerY);

			setThumbPosition(next);
			gameEventBus.emit(GAME_EVENTS.INPUT_MOVE, {
				x: next.x / MAX_RADIUS,
				y: next.y / MAX_RADIUS,
				active: true,
			});
		};

		const releasePointer = (event: PointerEvent) => {
			if (activePointerRef.current !== event.pointerId) {
				return;
			}

			activePointerRef.current = null;
			setThumbPosition({ x: 0, y: 0 });
			gameEventBus.emit(GAME_EVENTS.INPUT_MOVE, { x: 0, y: 0, active: false });
		};

		window.addEventListener("pointermove", handlePointerMove, { passive: false });
		window.addEventListener("pointerup", releasePointer);
		window.addEventListener("pointercancel", releasePointer);

		return () => {
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", releasePointer);
			window.removeEventListener("pointercancel", releasePointer);
		};
	}, [disabled]);

	const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
		if (disabled || !padRef.current) {
			return;
		}

		event.preventDefault();
		activePointerRef.current = event.pointerId;

		const rect = padRef.current.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;
		const next = clampThumbPosition(event.clientX - centerX, event.clientY - centerY);

		setThumbPosition(next);
		gameEventBus.emit(GAME_EVENTS.INPUT_MOVE, {
			x: next.x / MAX_RADIUS,
			y: next.y / MAX_RADIUS,
			active: true,
		});
	};

	return (
		<div className="pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center px-6 sm:bottom-10">
			<div className="flex flex-col items-center gap-3">
				<p className="text-xs uppercase tracking-[0.35em] text-cyan-200/70">Joystick</p>
				<div
					ref={padRef}
					onPointerDown={handlePointerDown}
					className="pointer-events-auto relative rounded-full border border-cyan-300/25 bg-slate-950/60 shadow-[0_0_40px_rgba(34,211,238,0.12)] backdrop-blur touch-none"
					style={{ width: PAD_SIZE, height: PAD_SIZE }}
				>
					<div className="absolute inset-[18px] rounded-full border border-dashed border-cyan-300/15" />
					<div className="absolute inset-[40px] rounded-full border border-cyan-300/12" />
					<div
						className="absolute left-1/2 top-1/2 rounded-full border border-cyan-100/35 bg-cyan-300/85 shadow-[0_0_30px_rgba(103,232,249,0.35)] transition-transform duration-75"
						style={{
							width: THUMB_SIZE,
							height: THUMB_SIZE,
							transform: `translate(calc(-50% + ${thumbPosition.x}px), calc(-50% + ${thumbPosition.y}px))`,
						}}
					/>
				</div>
			</div>
		</div>
	);
}