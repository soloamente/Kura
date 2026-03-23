import { defineConfig } from "tsdown";

export default defineConfig({
	entry: "./src/index.ts",
	format: "esm",
	outDir: "./dist",
	clean: true,
	// Workspace packages + Trigger: bundle so Vercel Bun cold starts do not resolve
	// `@trigger.dev/sdk/v3` / `@triggerdotdev/source` (can throw ResolveMessage / exit 1).
	noExternal: [/@Kura\/.*/, /^@trigger\.dev\//],
});
