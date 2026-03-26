import { syncEnvVars } from "@trigger.dev/build/extensions/core";
import { parse } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@trigger.dev/sdk";

const triggerConfigDir = dirname(fileURLToPath(import.meta.url));

/**
 * Trigger’s deploy indexer loads task files, which import `@Kura/db` → `@Kura/env/server`.
 * Without these vars in the remote build, `createEnv` throws during indexing.
 * `syncEnvVars` uploads them to Trigger on each deploy (see Trigger deploy env docs).
 */
function envForTriggerSync(): Record<string, string> {
	const envPath = resolve(triggerConfigDir, ".env");
	const fromFile = existsSync(envPath)
		? (parse(readFileSync(envPath, "utf8")) as Record<string, string>)
		: {};
	const required = [
		"DATABASE_URL",
		"BETTER_AUTH_SECRET",
		"BETTER_AUTH_URL",
		"CORS_ORIGIN",
	] as const;
	const out: Record<string, string> = {};
	for (const key of required) {
		const v = fromFile[key] ?? process.env[key];
		if (v) out[key] = v;
	}
	const optional = ["AUTH_COOKIE_DOMAIN"] as const;
	for (const key of optional) {
		const v = fromFile[key] ?? process.env[key];
		if (v) out[key] = v;
	}
	return out;
}

export default defineConfig({
	project: "proj_rdcpxabpjgfawttpoucb",
	runtime: "node",
	logLevel: "log",
	// The max compute seconds a task is allowed to run. If the task run exceeds this duration, it will be stopped.
	// You can override this on an individual task.
	// See https://trigger.dev/docs/runs/max-duration
	maxDuration: 300,
	retries: {
		enabledInDev: true,
		default: {
			maxAttempts: 3,
			minTimeoutInMs: 1000,
			maxTimeoutInMs: 10000,
			factor: 2,
			randomize: true,
		},
	},
	dirs: ["src/trigger"],
	build: {
		extensions: [
			syncEnvVars(async () => {
				const env = envForTriggerSync();
				const missing = ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "CORS_ORIGIN"].filter(
					(k) => !env[k],
				);
				if (missing.length > 0) {
					console.warn(
						`[trigger.config] Missing env for syncEnvVars: ${missing.join(", ")}. ` +
							"Add apps/server/.env or export them before deploy, or set them in the Trigger dashboard.",
					);
				}
				return env;
			}),
		],
	},
});
