import Image from "next/image";
import Link from "next/link";

const minigames = [
	{
		slug: "minigame1",
		title: "Penguin Panic",
		description: "Keep the penguin alive as hidden ice chunks begin to sink away.",
		thumbnail: "/minigames/minigame1-thumbnail.svg",
	},
	{
		slug: "minigame2",
		title: "Skater City",
		description: "Press jump to clear ten holes in a side-scrolling skateboard run.",
		thumbnail: "/minigames/minigame2-thumbnail.svg",
	},
	{
		slug: "minigame3",
		title: "Entanglement",
		description: "Trace crossing spiral wires and match the lit symbol to its hidden partner before time runs out.",
		thumbnail: "/minigames/minigame3-thumbnail.svg",
	},
];

export default function Home() {
	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(0,255,208,0.18),_transparent_35%),linear-gradient(180deg,#07111f_0%,#04070d_100%)] px-6 py-10 text-white sm:px-10 lg:px-16">
			<main className="mx-auto flex w-full max-w-6xl flex-col gap-10">
				<header className="rounded-[2rem] border border-cyan-400/20 bg-slate-950/70 px-6 py-8 shadow-[0_0_80px_rgba(34,211,238,0.08)] backdrop-blur sm:px-8">
					<p className="text-sm font-medium uppercase tracking-[0.35em] text-cyan-300/80">Title</p>
					<h1 className="mt-4 text-4xl font-semibold tracking-[0.08em] text-cyan-100 sm:text-6xl">
						CYBER Minigames
					</h1>
					<p className="mt-4 max-w-2xl text-sm text-slate-300 sm:text-base">
						Pick a minigame to launch.
					</p>
				</header>

				<section>
					<div className="mb-4 flex items-center justify-between gap-4">
						<div>
							<p className="text-xs uppercase tracking-[0.3em] text-cyan-300/70">Minigames</p>
						</div>
					</div>

					<div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
						{minigames.map((game) => (
							<Link
								key={game.slug}
								href={`/${game.slug}`}
								className="group overflow-hidden rounded-[1.75rem] border border-cyan-400/20 bg-slate-950/70 transition-transform duration-200 hover:-translate-y-1 hover:border-cyan-300/45 hover:shadow-[0_18px_60px_rgba(34,211,238,0.12)]"
							>
								<div className="relative aspect-[16/10] overflow-hidden border-b border-cyan-400/20 bg-slate-900">
									<Image
										src={game.thumbnail}
										alt={`${game.title} thumbnail`}
										fill
										priority
										className="object-cover transition-transform duration-300 group-hover:scale-105"
									/>
								</div>
								<div className="space-y-3 px-5 py-5">
									<div className="flex items-center justify-between gap-3">
										<h3 className="text-xl font-semibold text-slate-50">{game.title}</h3>
									</div>
									<p className="text-sm text-slate-300">{game.description}</p>
									<div className="inline-flex items-center rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950">
										Start minigame
									</div>
								</div>
							</Link>
						))}
					</div>
				</section>
			</main>
		</div>
	);
}
