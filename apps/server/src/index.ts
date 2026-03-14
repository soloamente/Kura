import { auth } from "@Kura/auth";
import { env } from "@Kura/env/server";
import { devToolsMiddleware } from "@ai-sdk/devtools";
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
		const uiMessages =
			typeof body === "object" && body !== null && "messages" in body
				? ((body as { messages?: unknown }).messages ?? [])
				: [];
		const model = wrapLanguageModel({
			model: google("gemini-2.5-flash"),
			middleware: devToolsMiddleware(),
		});
		const result = streamText({
			model,
			messages: await convertToModelMessages(uiMessages),
		});

		return result.toUIMessageStreamResponse();
	})
	.get("/", () => "OK")
	.listen(3000, () => {
		console.log("Server is running on http://localhost:3000");
	});

export type App = typeof app;
