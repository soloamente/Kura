import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Elysia, t } from "elysia";
import { authMiddleware } from "./middleware/auth";
import { getActiveUser } from "./middleware/auth-guards";

// ─── R2 / S3-compatible client ────────────────────────────────────────────────

const r2 = new S3Client({
	region: "auto",
	endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
	credentials: {
		accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
		secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
	},
});

const BUCKET = process.env.R2_BUCKET_NAME ?? "kura-media";
// Public base URL for the R2 bucket (set this to your pub-XXXX.r2.dev or custom domain)
const PUBLIC_BASE = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// ─── Router ───────────────────────────────────────────────────────────────────

export const uploadRouter = new Elysia({ prefix: "/users/me" })
	.use(authMiddleware)

	// POST /users/me/upload?type=avatar|banner
	.post(
		"/upload",
		async ({ user: me, query, body, set }) => {
			const activeUser = getActiveUser(me, set);
			if ("message" in activeUser) return activeUser;

			const file: File = body.file;

			// validate mime type
			if (!ALLOWED_TYPES.includes(file.type)) {
				set.status = 400;
				return { message: "Only JPEG, PNG, WebP and GIF images are allowed" };
			}

			// validate size
			if (file.size > MAX_SIZE_BYTES) {
				set.status = 400;
				return { message: "File must be smaller than 5 MB" };
			}

			const type = query.type ?? "avatar";
			const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
			// use timestamp for cache-busting
			const key = `${type}s/${activeUser.id}/${Date.now()}.${ext}`;

			// upload to R2
			const buffer = await file.arrayBuffer();
			await r2.send(
				new PutObjectCommand({
					Bucket: BUCKET,
					Key: key,
					Body: new Uint8Array(buffer),
					ContentType: file.type,
					// allow public reads
					ACL: "public-read",
				}),
			);

			const url = `${PUBLIC_BASE}/${key}`;

			// return the URL without saving it to the DB — the client stages it
			// and persists it only when the user clicks "Save profile"
			return { url };
		},
		{
			query: t.Object({
				type: t.Optional(t.Union([t.Literal("avatar"), t.Literal("banner")])),
			}),
			body: t.Object({
				file: t.File(),
			}),
		},
	);
