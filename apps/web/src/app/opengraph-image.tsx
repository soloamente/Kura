import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

/** OG / social preview: white canvas with centered letterpress artwork (`public/shared_letterpress.png`). */
export const alt = "Cura";

export const size = {
	width: 1200,
	height: 630,
};

export const contentType = "image/png";

/** Node runtime so we can read the PNG from `public/` at build/request time. */
export const runtime = "nodejs";

/** Read width/height from the PNG IHDR chunk (no extra deps). */
function getPngDimensions(buffer: Buffer): { width: number; height: number } {
	if (buffer.length < 24) {
		throw new Error("PNG too small");
	}
	// First chunk after signature should be IHDR at byte offset 12.
	if (buffer.toString("ascii", 12, 16) !== "IHDR") {
		throw new Error("Expected IHDR chunk");
	}
	return {
		width: buffer.readUInt32BE(16),
		height: buffer.readUInt32BE(20),
	};
}

export default async function OpenGraphImage() {
	const pngPath = join(process.cwd(), "public", "shared_letterpress.png");
	const buf = await readFile(pngPath);
	const { width: iw, height: ih } = getPngDimensions(buf);

	// Keep the artwork modest on the 1200×630 canvas (cap longest edge).
	const maxEdgePx = 400;
	const scale = Math.min(1, maxEdgePx / Math.max(iw, ih));
	const imgWidth = Math.round(iw * scale);
	const imgHeight = Math.round(ih * scale);

	const dataUrl = `data:image/png;base64,${buf.toString("base64")}`;

	return new ImageResponse(
		(
			<div
				style={{
					width: "100%",
					height: "100%",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: "#ffffff",
				}}
			>
				<img
					src={dataUrl}
					alt=""
					width={imgWidth}
					height={imgHeight}
					style={{ objectFit: "contain" }}
				/>
			</div>
		),
		{
			...size,
		},
	);
}
