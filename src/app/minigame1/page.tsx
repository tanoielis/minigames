import Minigame1Shell from "@/game/components/minigame1-shell";

export default async function Minigame1Page({
	searchParams,
}: {
	searchParams: Promise<{ mode?: string }>;
}) {
	const params = await searchParams;
	return <Minigame1Shell shuffleMode={params.mode === "shuffle"} />;
}