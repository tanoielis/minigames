"use client";

import Image from "next/image";
import Link from "next/link";
import { Grid2x2, LayoutList, Minus, Plus, Shuffle } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { createShuffleHref, pickRandomMinigame } from "@/game/shuffle";

const minigames = [
	{
		slug: "minigame1",
		title: "Penguin Panic",
		description: "Keep the penguin alive as hidden ice chunks begin to sink away.",
		thumbnail: "/minigames/minigame1/thumbnail.svg",
	},
	{
		slug: "minigame2",
		title: "Skater City",
		description: "Press jump to clear ten holes in a side-scrolling skateboard run.",
		thumbnail: "/minigames/minigame2/thumbnail.svg",
	},
	{
		slug: "minigame3",
		title: "Entanglement",
		description: "Trace crossing spiral wires and match the lit symbol to its hidden partner before time runs out.",
		thumbnail: "/minigames/minigame3/thumbnail.svg",
	},
	{
		slug: "minigame4",
		title: "Neon Rider",
		description: "Flip your drift direction and weave through three-lane traffic for twenty seconds on a vertical cyber highway.",
		thumbnail: "/minigames/minigame4/thumbnail.svg",
	},
	{
		slug: "minigame5",
		title: "Joust Royale",
		description: "Steady your lance marker with the joystick, track the rival knight through the charge, and win the best-of-three tilt.",
		thumbnail: "/minigames/minigame5/thumbnail.svg",
	},
	{
		slug: "minigame6",
		title: "Box-Off!",
		description: "Work behind the jab, block the telegraphed shots, and survive three short rounds or score the knockout.",
		thumbnail: "/minigames/minigame6/thumbnail.svg",
	},
	{
		slug: "minigame7",
		title: "Cloud Run",
		description: "Bank through open sky, dodge hostile planes, and survive twenty seconds above the ocean.",
		thumbnail: "/minigames/minigame7/thumbnail.svg",
	},
	{
		slug: "minigame8",
		title: "Coffee Chaos",
		description: "Juggle two brew heads, one steam wand, and a growing cafe queue before the rush collapses.",
		thumbnail: "/minigames/minigame8/thumbnail.svg",
	},
	{
		slug: "minigame9",
		title: "Blackjack",
		description: "Hit or stand to beat the dealer in this quick card table race.",
		thumbnail: "/minigames/minigame9/thumbnail.svg",
	},
];

const COMPACT_MODE_KEY = "cyber-menu-compact";
const MOBILE_COLUMNS_KEY = "cyber-menu-columns";
const MIN_MOBILE_COLUMNS = 1;
const MAX_MOBILE_COLUMNS = 10;

function IconButton({
	onClick,
	label,
	children,
	active = false,
	disabled = false,
}: {
	onClick: () => void;
	label: string;
	children: React.ReactNode;
	active?: boolean;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-label={label}
			className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${active ? "border-cyan-200 bg-cyan-200 text-slate-950" : "border-cyan-100/16 bg-slate-950/35 text-cyan-50 hover:border-cyan-100/42 hover:bg-slate-950/55"} disabled:cursor-default disabled:border-cyan-100/8 disabled:bg-slate-950/20 disabled:text-slate-500`}
		>
			{children}
		</button>
	);
}

export default function Home() {
	const router = useRouter();
	const [compactMode, setCompactMode] = useState(false);
	const [mobileColumns, setMobileColumns] = useState(2);

	useEffect(() => {
		const savedCompact = window.localStorage.getItem(COMPACT_MODE_KEY);
		const savedColumns = window.localStorage.getItem(MOBILE_COLUMNS_KEY);

		if (savedCompact === "true") {
			setCompactMode(true);
		}

		if (savedColumns) {
			const parsed = Number(savedColumns);
			if (Number.isFinite(parsed)) {
				setMobileColumns(Math.min(MAX_MOBILE_COLUMNS, Math.max(MIN_MOBILE_COLUMNS, parsed)));
			}
		}
	}, []);

	const handleCompactMode = () => {
		setCompactMode((current) => {
			const next = !current;
			window.localStorage.setItem(COMPACT_MODE_KEY, String(next));
			return next;
		});
	};

	const handleMobileColumns = (value: number) => {
		const next = Math.min(MAX_MOBILE_COLUMNS, Math.max(MIN_MOBILE_COLUMNS, value));
		setMobileColumns(next);
		window.localStorage.setItem(MOBILE_COLUMNS_KEY, String(next));
	};

	const handleShuffle = () => {
		router.push(createShuffleHref(pickRandomMinigame()));
	};

	const gameCount = minigames.length;
	const gridClass = compactMode
		? "sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
		: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
	const gridStyle = {
		"--mobile-columns": mobileColumns,
	} as CSSProperties;

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(138,0,196,0.22),_transparent_32%),radial-gradient(circle_at_80%_20%,_rgba(250,204,21,0.12),_transparent_24%),linear-gradient(180deg,#08111d_0%,#04070d_100%)] px-4 py-5 text-white sm:px-8 sm:py-8 lg:px-12">
			<main className="mx-auto flex w-full max-w-7xl flex-col gap-6">
				<section className="overflow-hidden rounded-[2rem] border border-[#8A00C4]/40 bg-[linear-gradient(135deg,rgba(8,17,29,0.92),rgba(8,17,29,0.72)),radial-gradient(circle_at_top_right,rgba(138,0,196,0.22),transparent_36%)] p-5 shadow-[0_20px_80px_rgba(138,0,196,0.18)] backdrop-blur sm:p-7">
					<div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
						<div className="max-w-3xl">
							<p className="text-[11px] uppercase tracking-[0.42em] text-cyan-200/65">{gameCount} minigames activated</p>
							<h1 className="mt-3 font-semibold leading-none text-[#8A00C4] text-[clamp(2.5rem,8vw,5.8rem)] [text-shadow:0_0_12px_rgba(138,0,196,0.95),0_0_30px_rgba(138,0,196,0.65),0_0_56px_rgba(138,0,196,0.35)]">
								CYBER Arcade
							</h1>
							<p className="mt-4 max-w-2xl text-sm text-slate-300 sm:text-base">Play. Win. Repeat.</p>
						</div>

						<div className="flex items-center gap-3 rounded-[1.5rem] border border-cyan-100/10 bg-slate-950/36 p-3 sm:min-w-[20rem] sm:justify-end">
							<button
								type="button"
								onClick={handleShuffle}
								className="inline-flex items-center gap-2 rounded-full border border-[#8A00C4]/40 bg-[#8A00C4] px-4 py-3 text-sm font-semibold text-white shadow-[0_0_24px_rgba(138,0,196,0.32)] transition-transform hover:-translate-y-0.5"
							>
								<Shuffle className="h-4 w-4" />
								Shuffle
							</button>
							<IconButton label={compactMode ? "Turn compact mode off" : "Turn compact mode on"} onClick={handleCompactMode} active={compactMode}>
								{compactMode ? <LayoutList className="h-4 w-4" /> : <Grid2x2 className="h-4 w-4" />}
							</IconButton>
							<div className="flex items-center gap-2 rounded-full border border-cyan-100/10 bg-slate-950/30 px-2 py-2">
								<IconButton label="Decrease mobile columns" onClick={() => handleMobileColumns(mobileColumns - 1)} disabled={mobileColumns <= MIN_MOBILE_COLUMNS}>
									<Minus className="h-4 w-4" />
								</IconButton>
								<div className="min-w-10 text-center text-sm font-semibold text-cyan-50">{mobileColumns}</div>
								<IconButton label="Increase mobile columns" onClick={() => handleMobileColumns(mobileColumns + 1)} disabled={mobileColumns >= MAX_MOBILE_COLUMNS}>
									<Plus className="h-4 w-4" />
								</IconButton>
							</div>
						</div>
					</div>
				</section>

				<section className="space-y-4">
					<div className={`grid gap-4 sm:gap-5 [grid-template-columns:repeat(var(--mobile-columns),minmax(0,1fr))] max-[359px]:[grid-template-columns:repeat(1,minmax(0,1fr))] ${gridClass}`} style={gridStyle}>
						{minigames.map((game, index) => (
							<Link
								key={game.slug}
								href={`/${game.slug}`}
								className={compactMode
									? "group overflow-hidden rounded-[1.5rem] border border-cyan-100/15 bg-slate-950/64 p-2 transition-transform duration-200 hover:-translate-y-1 hover:border-cyan-200/40 hover:shadow-[0_18px_40px_rgba(34,211,238,0.12)]"
									: "group overflow-hidden rounded-[1.75rem] border border-cyan-100/14 bg-slate-950/68 transition-transform duration-200 hover:-translate-y-1 hover:border-cyan-200/36 hover:shadow-[0_18px_50px_rgba(34,211,238,0.12)]"}
								aria-label={`Open ${game.title}`}
								title={game.title}
							>
								{compactMode ? (
									<div className="relative aspect-square overflow-hidden rounded-[1.15rem] bg-slate-900">
										<Image
											src={game.thumbnail}
											alt={`${game.title} icon`}
											fill
											priority
											className="object-cover transition-transform duration-300 group-hover:scale-105"
										/>
										<div className="absolute left-2 top-2 rounded-full bg-slate-950/72 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-50">
											{index + 1}
										</div>
									</div>
								) : (
									<>
										<div className="relative aspect-[16/10] overflow-hidden border-b border-cyan-100/12 bg-slate-900">
											<Image
												src={game.thumbnail}
												alt={`${game.title} thumbnail`}
												fill
												priority
												className="object-cover transition-transform duration-300 group-hover:scale-105"
											/>
											<div className="absolute left-3 top-3 rounded-full border border-cyan-100/20 bg-slate-950/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-50">
												Game {index + 1}
											</div>
										</div>
										<div className="space-y-3 px-4 py-4 sm:px-5 sm:py-5">
											<h3 className="text-lg font-semibold text-slate-50 sm:text-xl">{game.title}</h3>
											<p className="text-sm text-slate-300">{game.description}</p>
											<div className="inline-flex items-center rounded-full border border-cyan-100/14 bg-cyan-200 px-4 py-2 text-sm font-semibold text-slate-950">
												Launch
											</div>
										</div>
									</>
								)}
							</Link>
						))}
					</div>
				</section>
			</main>
		</div>
	);
}
