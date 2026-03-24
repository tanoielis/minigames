import Minigame6Shell from "@/game/components/minigame6-shell";

export default async function Minigame6Page({
	searchParams,
}: {
	searchParams: Promise<{ mode?: string }>;
}) {
	const params = await searchParams;
	return <Minigame6Shell shuffleMode={params.mode === "shuffle"} />;
}