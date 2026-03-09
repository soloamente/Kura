# Agent memory

## Learned User Preferences

- Prefer slow, smooth UI animations; when the user reports "chunky," "fast without smoothness," or "weird," use spring physics or longer durations with ease-in-out instead of short duration + cubic ease.
- For header or chip collapse flows, include all relevant tabs (e.g. "All") in the animated exit so they fade or collapse together; collapse the group's maxWidth to 0 so hidden elements do not affect layout.
- When an animated element (e.g. plus icon with translateX) escapes its container despite overflow-hidden, prefer removing the transform over adding more overflow or wrapper fixes.

## Learned Workspace Facts

- Motion library is imported from `motion/react` in this codebase.
- Server dev runs from repo root so Bun `--hot` watches `packages/auth`, `packages/env`, and `packages/db`; server loads `.env` from `apps/server` via `load-env.ts`.
- Better Auth: avoid `authClient.useSession()` in SignInForm and SignUpForm on this stack (Next 16, React 19, Turbopack) to prevent "selector is not a function"; use `getSession()` or render the form without session there.
