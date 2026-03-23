import { treaty } from "@elysiajs/eden";
import type { App } from "../../../server/src/main";

export const api = treaty<App>("http://localhost:3000", {
	fetch: { credentials: "include" },
});
