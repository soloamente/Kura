/**
 * Vercel's Elysia integration runs this file with Node. Workspace packages (`@Kura/*`)
 * point `exports` at `.ts` sources, which are not runnable in production. The real app
 * is bundled by tsdown into `dist/main.mjs`; we re-export it here so cold starts never
 * resolve workspace TypeScript entrypoints (see ERR_MODULE_NOT_FOUND on Vercel).
 */
export type { App } from "./main";
// Bundled JS has no sibling .d.ts; server `tsc -b` needs this suppression.
// @ts-expect-error -- no declaration file for the Rolldown output artifact
export { default } from "../dist/main.mjs";
