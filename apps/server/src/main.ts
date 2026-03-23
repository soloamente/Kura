import { auth } from "@Kura/auth";
import { env } from "@Kura/env/server";
import { google } from "@ai-sdk/google";
import { cors } from "@elysiajs/cors";
import { convertToModelMessages, streamText, wrapLanguageModel } from "ai";
import { Elysia } from "elysia";
import { adminRouter } from "./admin";
import { bookmarksRouter } from "./bookmarks";
import { collectionsRouter } from "./collections";
import { exploreRouter } from "./explore";
import { tagsRouter } from "./tags";
import { uploadRouter } from "./upload";
import { usersRouter } from "./users";

const app = new Elysia()
	.use(
		cors({
			origin: env.CORS_ORIGIN,
			methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
			allowedHeaders: ["Content-Type", "Authorization"],
			credentials: true,
		}),
	)
	.use(adminRouter)
	.use(exploreRouter)
	.use(usersRouter)
	.use(uploadRouter)
	.use(bookmarksRouter)
	.use(collectionsRouter)
	.use(tagsRouter)
	.all("/api/auth/*", async (context) => {
		const { request, status } = context;
		if (["POST", "GET"].includes(request.method)) {
			return auth.handler(request);
		}
		return status(405);
	})
	.post("/ai", async (context) => {
		const body: unknown = await context.request.json();
		const rawMessages =
			typeof body === "object" && body !== null && "messages" in body
				? (body as { messages?: unknown }).messages
				: undefined;
		const uiMessages = Array.isArray(rawMessages) ? rawMessages : [];
		// DevTools touches the filesystem / local server — load it only in development
		// so Vercel serverless cold starts do not import it in production.
		const baseModel = google("gemini-2.5-flash");
		const model =
			env.NODE_ENV === "development"
				? wrapLanguageModel({
						model: baseModel,
						middleware: (await import("@ai-sdk/devtools")).devToolsMiddleware(),
					})
				: baseModel;
		const result = streamText({
			model,
			messages: await convertToModelMessages(
				uiMessages as Parameters<typeof convertToModelMessages>[0],
			),
		});

		return result.toUIMessageStreamResponse();
	})
	.get("/", () => "OK");

// Vercel runs the bundle as a serverless function: `app.listen` is not supported there
// (see https://vercel.com/docs/frameworks/backend/elysia). Export the app as default;
// only bind to a port for local / self-hosted runs.
if (process.env.VERCEL !== "1") {
	const port = Number(process.env.PORT) || 3000;
	app.listen(port, () => {
		console.log(`Server is running on http://localhost:${port}`);
	});
}

export default app;
export type App = typeof app;
