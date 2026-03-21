import Link from "next/link";
import PhaserGame from "@/game/components/phaser-game";

export default function Minigame1Page() {
	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(0,255,208,0.14),_transparent_32%),linear-gradient(180deg,#07111f_0%,#04070d_100%)] px-6 py-10 text-white sm:px-10 lg:px-16">
			<main className="mx-auto flex w-full max-w-6xl flex-col gap-8">
				<div className="flex items-center justify-between gap-4">
					<div>
						<p className="text-xs uppercase tracking-[0.3em] text-cyan-300/70">CYBER Minigames</p>
						<h1 className="mt-2 text-3xl font-semibold text-cyan-100 sm:text-5xl">Minigame 1</h1>
						<p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
							Base Phaser wiring with a preload scene, React bridge, and a simple scene drawing the first rectangle.
						</p>
					</div>
					<Link
						href="/"
						className="rounded-full border border-cyan-300/40 px-4 py-2 text-sm font-medium text-cyan-100 transition-colors hover:bg-cyan-300 hover:text-slate-950"
					>
						Back to hub
					</Link>
				</div>

				<PhaserGame />
			</main>
		</div>
	);
}