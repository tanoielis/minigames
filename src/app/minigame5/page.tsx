import Minigame5Shell from "@/game/components/minigame5-shell";

export default async function Minigame5Page({
	searchParams,
}: {
	searchParams: Promise<{ mode?: string }>;
}) {
	const params = await searchParams;
	return <Minigame5Shell shuffleMode={params.mode === "shuffle"} />;
}