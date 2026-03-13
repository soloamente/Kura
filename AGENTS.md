# Agent memory

## Learned User Preferences

- Prefer slow, smooth UI animations; when the user reports "chunky," "fast without smoothness," or "weird," use spring physics or longer durations with ease-in-out instead of short duration + cubic ease.
- For header or chip collapse flows, include all relevant tabs (e.g. "All") in the animated exit so they fade or collapse together; collapse the group's maxWidth to 0 so hidden elements do not affect layout.
- When an animated element (e.g. plus icon with translateX) escapes its container despite overflow-hidden, prefer removing the transform over adding more overflow or wrapper fixes.
- Collection chips and dashboard segment chips: active state uses `bg-foreground text-background`; inactive state uses `text-foreground` with no background fill — not `bg-primary text-primary-foreground`.
- When applying a styling change to one chip variant, apply it consistently to all related variants (All tab, Trash tab, CollectionChip, etc.) without waiting to be asked.
- All clickable UI elements (buttons, interactive chips, clickable wrappers, menu triggers) should explicitly use `cursor-pointer`; disabled actions should use `disabled:cursor-not-allowed` so they clearly look non-interactive.
- The overall UI should lean into a premium, modern, minimal dark-luxury aesthetic (cinematic glass layers, subtle gradients, restrained motion) rather than noisy or heavy visual treatments.
- In settings sections that poll (e.g. Friends), show the loading skeleton only on initial load, not during background refreshes.

## Learned Workspace Facts

- Motion library is imported from `motion/react` in this codebase.
- Server dev runs from repo root so Bun `--hot` watches `packages/auth`, `packages/env`, and `packages/db`; server loads `.env` from `apps/server` via `load-env.ts`.
- Better Auth: avoid `authClient.useSession()` in SignInForm and SignUpForm on this stack (Next 16, React 19, Turbopack) to prevent "selector is not a function"; use `getSession()` or render the form without session there.
- R2 media storage is configured with bucket `kura-media`; credentials (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`) live in `apps/server/.env`; the S3-compatible SDK endpoint is `https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com`; `R2_PUBLIC_URL` must be the public-facing `pub-*.r2.dev` (or custom domain) URL, not the API endpoint.
- DB schema lives in `packages/db/src/schema/`; push schema changes with `bun drizzle-kit push` from `packages/db/`.
- Base UI: `ContextMenu.SubmenuTrigger` must be a direct child of `ContextMenu.SubmenuRoot` — placing it as a sibling of `ContextMenu.Submenu` throws a runtime error.
- When using `event.currentTarget` in a React setState updater (e.g. checkbox `onChange`), read the value (e.g. `checked`) into a local variable at the start of the handler and use that variable inside the updater; otherwise `currentTarget` may be null when the updater runs.
- Web env vars (e.g. `NEXT_PUBLIC_SERVER_URL`) go in `apps/web/.env`; the dev server must be restarted after creating or modifying that file.
- Real-time polling for followed-collection bookmarks and collection metadata uses 5-second intervals; the public profile page polls tab content roughly every 5 seconds and profile header data around every 10 seconds to keep avatar, banner, and counts fresh.
- Settings → Friends: poll (e.g. every 5s) so incoming and outgoing friend requests update without reload.
