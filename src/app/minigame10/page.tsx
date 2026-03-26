import Minigame10Shell from "@/game/components/minigame10-shell";

export default async function Minigame10Page({
	searchParams,
}: {
	searchParams: Promise<{ mode?: string }>;
}) {
	const params = await searchParams;
	return <Minigame10Shell shuffleMode={params.mode === "shuffle"} />;
}