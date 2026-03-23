import { env } from "@Kura/env/web";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	baseURL: env.NEXT_PUBLIC_SERVER_URL,
	// Explicit for cross-origin (web app origin !== API origin): send session cookies to the API host.
	fetchOptions: {
		credentials: "include",
	},
});
