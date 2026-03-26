export const MINIGAME_SLUGS = [
	"minigame1",
	"minigame2",
	"minigame3",
	"minigame4",
	"minigame5",
	"minigame6",
	"minigame7",
	"minigame8",
	"minigame9",
] as const;

export type MinigameSlug = (typeof MINIGAME_SLUGS)[number];

export function pickRandomMinigame(excludeSlug?: MinigameSlug | string) {
	const pool = excludeSlug ? MINIGAME_SLUGS.filter((slug) => slug !== excludeSlug) : MINIGAME_SLUGS;
	return pool[Math.floor(Math.random() * pool.length)] ?? MINIGAME_SLUGS[0];
}

export function createShuffleHref(slug: MinigameSlug | string) {
	return `/${slug}?mode=shuffle`;
}