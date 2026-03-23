/**
 * Vercel's Elysia integration runs this file with Node. Workspace packages (`@Kura/*`)
 * point `exports` at `.ts` sources, which are not runnable in production. The real app
 * is bundled by tsdown into `dist/main.mjs`; we re-export it here so cold starts never
 * resolve workspace TypeScript entrypoints (see ERR_MODULE_NOT_FOUND on Vercel).
 */
export type { App } from "./main";
// tsdown emits JS only for the bundle; types for consumers come from `./main` above.
// @ts-expect-error -- no declaration file for the Rolldown output artifact
export { default } from "../dist/main.mjs";
