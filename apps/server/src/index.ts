import { auth } from "@Kura/auth";
import { env } from "@Kura/env/server";
import { devToolsMiddleware } from "@ai-sdk/devtools";
import { google } from "@ai-sdk/google";
import { cors } from "@elysiajs/cors";
import { convertToModelMessages, streamText, wrapLanguageModel } from "ai";
import { Elysia } from "elysia";
import { collectionsRouter } from "./collections";
import { bookmarksRouter } from "./bookmarks";

const app = new Elysia()
	.use(
		cors({
			origin: env.CORS_ORIGIN,
			methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
			allowedHeaders: ["Content-Type", "Authorization"],
			credentials: true,
		}),
	)
	.use(bookmarksRouter)
	.use(collectionsRouter)
	.all("/api/auth/*", async (context) => {
		const { request, status } = context;
		if (["POST", "GET"].includes(request.method)) {
			return auth.handler(request);
		}
		return status(405);
	})
	.post("/ai", async (context) => {
		const body = await context.request.json();
		const uiMessages = body.messages || [];
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
