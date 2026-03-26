"use client";

import { GAME_EVENTS, gameEventBus } from "@/game/event-bus";

type CoffeeChaosControlsState = {
	smallCupDisabled: boolean;
	largeCupDisabled: boolean;
	regularMilkDisabled: boolean;
	oatMilkDisabled: boolean;
	pullLeftDisabled: boolean;
	pullRightDisabled: boolean;
	pourMilkDisabled: boolean;
	chocolateDisabled: boolean;
	cinnamonDisabled: boolean;
};

const buttons: Array<{
	key:
		| "small-cup"
		| "large-cup"
		| "regular-milk"
		| "oat-milk"
		| "pull-left"
		| "pull-right"
		| "pour-milk"
		| "chocolate"
		| "cinnamon";
	label: string;
	accent: string;
	disabledKey: keyof CoffeeChaosControlsState;
}> = [
	{ key: "small-cup", label: "Small Cup", accent: "bg-amber-100 text-stone-950", disabledKey: "smallCupDisabled" },
	{ key: "large-cup", label: "Large Cup", accent: "bg-orange-200 text-stone-950", disabledKey: "largeCupDisabled" },
	{ key: "regular-milk", label: "Milk", accent: "bg-cyan-200 text-slate-950", disabledKey: "regularMilkDisabled" },
	{ key: "oat-milk", label: "Oat", accent: "bg-emerald-200 text-slate-950", disabledKey: "oatMilkDisabled" },
	{ key: "pull-left", label: "Pull L", accent: "bg-fuchsia-200 text-slate-950", disabledKey: "pullLeftDisabled" },
	{ key: "pull-right", label: "Pull R", accent: "bg-fuchsia-300 text-slate-950", disabledKey: "pullRightDisabled" },
	{ key: "pour-milk", label: "Pour", accent: "bg-sky-200 text-slate-950", disabledKey: "pourMilkDisabled" },
	{ key: "chocolate", label: "Choco", accent: "bg-stone-300 text-stone-950", disabledKey: "chocolateDisabled" },
	{ key: "cinnamon", label: "Cinnamon", accent: "bg-rose-200 text-stone-950", disabledKey: "cinnamonDisabled" },
];

export default function CoffeeChaosControls({ disabled }: { disabled: CoffeeChaosControlsState }) {
	const handlePress = (
		action:
			| "small-cup"
			| "large-cup"
			| "regular-milk"
			| "oat-milk"
			| "pull-left"
			| "pull-right"
			| "pour-milk"
			| "chocolate"
			| "cinnamon",
	) => (event: React.PointerEvent<HTMLButtonElement>) => {
		event.preventDefault();
		gameEventBus.emit(GAME_EVENTS.MINIGAME8_ACTION, { action });
	};

	return (
		<div className="pointer-events-none fixed inset-x-0 bottom-3 z-30 flex justify-center px-3 sm:bottom-6 sm:px-6">
			<div className="pointer-events-auto grid w-full max-w-3xl grid-cols-3 gap-2 rounded-[1.6rem] border border-orange-100/12 bg-slate-950/76 p-3 shadow-[0_20px_60px_rgba(15,23,42,0.45)] backdrop-blur-sm sm:gap-3 sm:p-4">
				{buttons.map((button) => {
					const isDisabled = disabled[button.disabledKey];
					const disabledClass = isDisabled ? "cursor-default bg-slate-700/70 text-slate-300" : button.accent;

					return (
						<button
							key={button.key}
							type="button"
							onPointerDown={isDisabled ? undefined : handlePress(button.key)}
							disabled={isDisabled}
							className={`rounded-[1.1rem] px-2 py-3 text-[11px] font-black uppercase tracking-[0.14em] transition-transform active:scale-95 sm:px-4 sm:py-4 sm:text-sm ${disabledClass}`}
							style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}
						>
							{button.label}
						</button>
					);
				})}
			</div>
		</div>
	);
}
