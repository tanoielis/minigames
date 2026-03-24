import Minigame2Shell from "@/game/components/minigame2-shell";

export default async function Minigame2Page({
	searchParams,
}: {
	searchParams: Promise<{ mode?: string }>;
}) {
	const params = await searchParams;
	return <Minigame2Shell shuffleMode={params.mode === "shuffle"} />;
}