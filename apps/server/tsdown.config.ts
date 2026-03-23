import { defineConfig } from "tsdown";

export default defineConfig({
	entry: "./src/main.ts",
	format: "esm",
	outDir: "./dist",
	clean: true,
	// Bundle app + nearly all dependencies so the serverless artifact does not rely on
	// Bun's module resolver at cold start (empty `ResolveMessage {}` + exit 1 on Vercel).
	noExternal: [
		/@Kura\/.*/,
		/^@trigger\.dev\//,
		/^elysia$/,
		/^@elysiajs\//,
		/^ai$/,
		/^@ai-sdk\//,
		/^better-auth/,
		/^zod/, // zod, zod/v4, zod/v3, ...
		/^dotenv/, // dotenv, dotenv/config
		/^@aws-sdk\//,
	],
});
