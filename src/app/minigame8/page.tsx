import Minigame8Shell from "@/game/components/minigame8-shell";

export default async function Minigame8Page({
	searchParams,
}: {
	searchParams: Promise<{ mode?: string }>;
}) {
	const params = await searchParams;
	return <Minigame8Shell shuffleMode={params.mode === "shuffle"} />;
}
