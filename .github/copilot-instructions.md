# Project Guidelines

## Architecture
- This repository is a small Next.js 16 App Router app prepared for Cloudflare deployment through OpenNext.
- Application code currently lives under `src/app`. Treat `src/app/layout.tsx` as the global shell and `src/app/page.tsx` as the current home route entry point.
- Phaser gameplay code lives under `src/game`. Keep Phaser scene logic there, and keep page layout, overlays, and touch controls in React components.
- `src/app/minigame1/page.tsx` is the current playable route and mounts the React shell for the first minigame.
- The React/Phaser bridge currently uses `src/game/event-bus.ts` for input, restart, and game-state events.
- Cloudflare/OpenNext integration is configured in `next.config.ts`, `open-next.config.ts`, and `wrangler.jsonc`. Preserve that wiring when changing runtime behavior or deployment settings.
- `next.config.ts` initializes local Cloudflare bindings support for `next dev` via `initOpenNextCloudflareForDev()`.

## Build and Test
- Install dependencies with `npm install`.
- Use `npm run dev` for local Next.js development.
- Use `npm run lint` as the primary validation step for routine changes.
- Use `npm run build` when a task could affect routing, bundling, client/server boundaries, or when a build-specific problem has occurred.
- Use `npm run preview` to test the OpenNext Cloudflare runtime locally.
- Use `npm run deploy` for Cloudflare deployment and `npm run upload` for OpenNext upload flows.
- Use `npm run cf-typegen` after adding or changing Cloudflare bindings so `cloudflare-env.d.ts` stays current.
- There are currently no dedicated test scripts in this repository.

## Code Style
- Follow the existing TypeScript, React, and Next.js App Router patterns already in `src/app`.
- Preserve the repo's current formatting style: tabs for indentation, double quotes, and minimal inline comments.
- Keep components and config changes small and direct; this codebase is still close to the starter template and does not need extra abstraction by default.

## Conventions
- Styling currently uses Tailwind CSS v4 via `src/app/globals.css`. Reuse the theme variables defined there before introducing new global tokens.
- The root layout currently loads Geist fonts through `next/font/google`; keep global typography changes centralized in `src/app/layout.tsx` and `src/app/globals.css`.
- Minigame pages are mobile-first. Prefer layouts that fit within a single viewport height on phones and avoid extra scrolling during gameplay.
- Keep gameplay HUD, overlays, restart UI, and on-screen controls in React unless there is a strong reason they must live inside Phaser.
- For Phaser work, prefer changing scene behavior and bridge events without tightly coupling scene code to Next.js page structure.
- When changing Cloudflare-related behavior, review `wrangler.jsonc` and `open-next.config.ts` together so local preview and deployment remain aligned.
- Prefer updating the existing README for developer workflow notes rather than duplicating long setup guidance here.

## Key References
- See `README.md` for the basic local development, preview, and deployment workflow.
- See `src/app/layout.tsx`, `src/app/page.tsx`, and `src/app/globals.css` for the current frontend structure and styling baseline.
- See `src/game/components/minigame1-shell.tsx`, `src/game/components/joystick-control.tsx`, and `src/game/scenes/minigame1-scene.ts` for the current gameplay, control, and React bridge patterns.