import Minigame3Shell from "@/game/components/minigame3-shell";

export default async function Minigame3Page({
	searchParams,
}: {
	searchParams: Promise<{ mode?: string }>;
}) {
	const params = await searchParams;
	return <Minigame3Shell shuffleMode={params.mode === "shuffle"} />;
}