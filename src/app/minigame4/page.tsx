import Minigame4Shell from "@/game/components/minigame4-shell";

export default async function Minigame4Page({
	searchParams,
}: {
	searchParams: Promise<{ mode?: string }>;
}) {
	const params = await searchParams;
	return <Minigame4Shell shuffleMode={params.mode === "shuffle"} />;
}