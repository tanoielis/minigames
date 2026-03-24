import Minigame7Shell from "@/game/components/minigame7-shell";

export default async function Minigame7Page({
	searchParams,
}: {
	searchParams: Promise<{ mode?: string }>;
}) {
	const params = await searchParams;
	return <Minigame7Shell shuffleMode={params.mode === "shuffle"} />;
}