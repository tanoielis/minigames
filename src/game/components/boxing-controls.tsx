"use client";

import { GAME_EVENTS, gameEventBus } from "@/game/event-bus";

type BoxingControlsState = {
	jabDisabled: boolean;
	hookDisabled: boolean;
	blockDisabled: boolean;
};

const buttons: Array<{ key: "jab" | "hook" | "block"; label: string; accent: string }> = [
	{ key: "jab", label: "Jab", accent: "bg-cyan-300 text-slate-950" },
	{ key: "hook", label: "Hook", accent: "bg-amber-200 text-stone-950" },
	{ key: "block", label: "Block", accent: "bg-rose-300 text-stone-950" },
];

export default function BoxingControls({ disabled }: { disabled: BoxingControlsState }) {
	const handlePress = (action: "jab" | "hook" | "block") => (event: React.PointerEvent<HTMLButtonElement>) => {
		event.preventDefault();
		gameEventBus.emit(GAME_EVENTS.BOXING_ACTION, { action });
	};

	return (
		<div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 sm:bottom-8 sm:px-6">
			<div className="pointer-events-auto flex w-full max-w-md gap-3 rounded-[1.5rem] border border-cyan-100/12 bg-slate-950/72 p-3 shadow-[0_20px_60px_rgba(15,23,42,0.45)] backdrop-blur-sm">
				{buttons.map((button) => {
					const isDisabled = disabled[`${button.key}Disabled`];
					const disabledClass = isDisabled ? "cursor-default bg-slate-700/70 text-slate-300" : button.accent;

					return (
						<button
							key={button.key}
							type="button"
							onPointerDown={handlePress(button.key)}
							aria-disabled={isDisabled}
							className={`flex-1 rounded-[1.2rem] px-4 py-4 text-sm font-black uppercase tracking-[0.18em] transition-transform active:scale-95 sm:text-base ${disabledClass}`}
							style={{
								WebkitTouchCallout: "none",
								WebkitUserSelect: "none",
								userSelect: "none",
							}}
						>
							{button.label}
						</button>
					);
				})}
			</div>
		</div>
	);
}