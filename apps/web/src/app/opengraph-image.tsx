import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

/** OG / social preview: white canvas with centered Cura wordmark (`public/favicon/Cura.svg`). */
export const alt = "Cura";

export const size = {
	width: 1200,
	height: 630,
};

export const contentType = "image/png";

/** Node runtime so we can read the SVG from `public/` at build/request time. */
export const runtime = "nodejs";

export default async function OpenGraphImage() {
	const svgPath = join(process.cwd(), "public", "favicon", "Cura.svg");
	const svg = await readFile(svgPath, "utf8");
	const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

	// Logo viewBox is 411×139 — keep the wordmark modest on the 1200×630 canvas.
	const logoWidth = 400;
	const logoHeight = Math.round((logoWidth * 139) / 411);

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
					width={logoWidth}
					height={logoHeight}
					style={{ objectFit: "contain" }}
				/>
			</div>
		),
		{
			...size,
		},
	);
}
