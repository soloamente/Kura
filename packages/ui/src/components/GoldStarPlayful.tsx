/* eslint-disable @typescript-eslint/ban-ts-comment */
"use client";

import Lottie from "lottie-react";
// @ts-expect-error - JSON animation data is bundled by the build tooling.
import goldStarPlayful from "./Gold-Star-Playful.json";
import type { GoldStarProps } from "./GoldStar";

/**
 * Playful Lottie-based gold star animation used for high-energy
 * achievement unlock toasts. Falls back to the static GoldStar
 * component in places where motion is not desired.
 */
export function GoldStarPlayful({
	className,
	size = 48,
	"aria-label": ariaLabel = "Achievement",
}: GoldStarProps) {
	return (
		<Lottie
			aria-label={ariaLabel}
			aria-hidden={!ariaLabel}
			animationData={goldStarPlayful}
			loop={false}
			style={{ width: size, height: size }}
			className={className}
		/>
	);
}
