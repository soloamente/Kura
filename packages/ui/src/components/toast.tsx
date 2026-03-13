"use client";

import { cn } from "@Kura/ui/lib/utils";
import {
	BookmarkPlus,
	BookOpen,
	Clock,
	Flame,
	FolderHeart,
	Library,
	Shield,
	Trophy,
	Users,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
	IconCircleCheckFilled,
	IconTriangleWarningFilled,
} from "nucleo-micro-bold";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { TextMorph } from "torph/react";
import { GoldStar } from "./GoldStar";
import { GoldStarPlayful } from "./GoldStarPlayful";
import { getBadgeIconMotion } from "./toast-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastState = "loading" | "success" | "error" | "warn";

interface ToastAction {
	label: string;
	onClick: () => void;
	// "primary" renders a filled pill; "secondary" renders a ghost pill (default)
	variant?: "primary" | "secondary";
}

export interface BadgeCelebrationVisuals {
	scale: number;
	glowOpacity: number;
	burstCount: number;
	durationMs: number;
}

interface BadgeToast {
	name: string;
	xp: number;
	celebration: "subtle" | "rare" | "epic";
	visuals: BadgeCelebrationVisuals;
	// category icon key — drives which icon renders and the accent color
	icon?: string;
	// OKLCH hue for category-colored glow, particles, and icon background
	hue?: number;
}

interface Toast {
	id: string;
	message: string;
	state: ToastState;
	duration?: number;
	// optional inline action buttons rendered on the same line as the message
	actions?: ToastAction[];
	badge?: BadgeToast;
}

interface ToastContextValue {
	toast: (
		message: string,
		state?: ToastState,
		duration?: number,
		actions?: ToastAction[],
	) => string;
	celebrateBadge: (badge: BadgeToast) => string;
	update: (
		id: string,
		message: string,
		state: ToastState,
		actions?: ToastAction[],
	) => void;
	dismiss: (id: string) => void;
	pauseAutoDismiss: (id: string) => void;
	resumeAutoDismiss: (id: string, duration: number) => void;
	promise: <T>(
		promise: Promise<T>,
		messages: { loading: string; success: string; error: string },
	) => Promise<T>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue>({
	toast: () => "",
	celebrateBadge: () => "",
	update: () => {},
	dismiss: () => {},
	pauseAutoDismiss: () => {},
	resumeAutoDismiss: () => {},
	promise: async (p) => p,
});

export function useToast() {
	return useContext(ToastContext);
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function SuccessIcon() {
	return (
		<motion.span
			initial={{ scale: 0.5, opacity: 0 }}
			animate={{ scale: 1, opacity: 1 }}
			transition={{ type: "spring", stiffness: 400, damping: 20 }}
			className="text-green-500"
		>
			<IconCircleCheckFilled size={20} />
		</motion.span>
	);
}

function ErrorIcon() {
	return (
		<motion.svg
			width="14"
			height="14"
			viewBox="0 0 14 14"
			fill="none"
			initial={{ scale: 0.5, opacity: 0 }}
			animate={{ scale: 1, opacity: 1 }}
			transition={{ type: "spring", stiffness: 400, damping: 20 }}
		>
			<circle
				cx="7"
				cy="7"
				r="6"
				fill="currentColor"
				className="text-destructive"
			/>
			<path
				d="M5 5l4 4M9 5l-4 4"
				stroke="white"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
		</motion.svg>
	);
}

function WarnIcon() {
	return (
		<motion.span
			initial={{ scale: 0.5, opacity: 0 }}
			animate={{ scale: 1, opacity: 1 }}
			transition={{ type: "spring", stiffness: 400, damping: 20 }}
			className="text-amber-400"
		>
			<IconTriangleWarningFilled size={20} />
		</motion.span>
	);
}

function LoadingIcon() {
	return (
		<motion.svg
			width="14"
			height="14"
			viewBox="0 0 14 14"
			fill="none"
			animate={{ rotate: 360 }}
			transition={{
				duration: 0.9,
				repeat: Number.POSITIVE_INFINITY,
				ease: "linear",
			}}
		>
			<circle
				cx="7"
				cy="7"
				r="5.5"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeDasharray="22 12"
				className="text-foreground/40"
			/>
		</motion.svg>
	);
}

// ─── Badge Toast Icons ────────────────────────────────────────────────────────
// Lightweight icon resolver for badge toasts. Mirrors the app's
// AchievementIcon mapping but lives in the shared UI package.

function BadgeIconGlyph({
	icon,
	className,
	size = 20,
}: {
	icon: string;
	className?: string;
	size?: number;
}) {
	// Use the custom Gold Star asset for star/favorite achievements and as default
	if (icon === "star" || icon === "") {
		return (
			<GoldStar size={size} className={className} aria-label="Achievement" />
		);
	}
	switch (icon) {
		case "bookmark-plus":
			return <BookmarkPlus className={className} />;
		case "bookmark-stack-1":
		case "bookmark-stack-2":
			return <Library className={className} />;
		case "users":
			return <Users className={className} />;
		case "flame-1":
			return <Flame className={className} />;
		case "book-open":
			return <BookOpen className={className} />;
		case "collection-follow":
			return <FolderHeart className={className} />;
		case "clock":
			return <Clock className={className} />;
		case "trophy":
			return <Trophy className={className} />;
		case "shield":
			return <Shield className={className} />;
		default:
			return (
				<GoldStar size={size} className={className} aria-label="Achievement" />
			);
	}
}

const DEFAULT_HUE = 220;
// Gold/amber hue for achievement (star) toasts: dashed gold border, gold badge
const GOLD_HUE = 75;

function BadgeBurst({
	index,
	count,
	level,
	hue,
}: {
	index: number;
	count: number;
	level: BadgeToast["celebration"];
	hue: number;
}) {
	const angle = (Math.PI * 2 * index) / count;
	const distance = level === "epic" ? 38 : level === "rare" ? 30 : 22;

	return (
		<motion.span
			className="absolute top-1/2 left-1/2 size-1.5 rounded-full"
			style={{ background: `oklch(0.70 0.16 ${hue})` }}
			initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
			animate={{
				opacity: [0, 1, 0],
				x: [0, Math.cos(angle) * distance],
				y: [0, Math.sin(angle) * distance],
				scale: [0.4, 1.1, 0.5],
			}}
			transition={{
				duration: level === "epic" ? 1 : 0.8,
				delay: 0.05 + index * 0.02,
				ease: "easeOut",
			}}
		/>
	);
}

function BadgeToastIcon({ badge }: { badge: BadgeToast }) {
	const iconMotion = getBadgeIconMotion(badge.celebration, badge.visuals.scale);
	const hue = badge.hue ?? DEFAULT_HUE;
	// Use gold ring and glow for star/achievement icon to match reference
	const isStarAchievement = badge.icon === "star" || badge.icon === "";
	const displayHue = isStarAchievement ? GOLD_HUE : hue;
	const usePlayfulStar =
		isStarAchievement &&
		(badge.celebration === "rare" || badge.celebration === "epic");

	return (
		<div className="relative flex size-12 shrink-0 items-center justify-center">
			{/* Category- or gold-colored radial glow */}
			<motion.span
				className="absolute inset-0 rounded-full blur-xl"
				style={{ background: `oklch(0.55 0.14 ${displayHue} / 0.5)` }}
				initial={{ opacity: 0, scale: 0.7 }}
				animate={{
					opacity: [0, badge.visuals.glowOpacity, 0],
					scale: [0.7, badge.visuals.scale, 1.08],
				}}
				transition={{
					duration: badge.visuals.durationMs / 1000,
					ease: "easeOut",
				}}
			/>

			{/* Burst particles with category color */}
			{Array.from({ length: badge.visuals.burstCount }).map((_, index) => (
				<BadgeBurst
					key={`${badge.name}-burst-${index}`}
					index={index}
					count={badge.visuals.burstCount}
					level={badge.celebration}
					hue={displayHue}
				/>
			))}

			<motion.span
				className="relative flex size-12 items-center justify-center"
				style={{
					color: `oklch(0.80 0.14 ${displayHue})`,
				}}
				initial={{ scale: 0.6, rotate: -8, opacity: 0 }}
				animate={iconMotion.animate}
				transition={iconMotion.transition}
			>
				{usePlayfulStar ? (
					<GoldStarPlayful
						size={48}
						className="size-12"
						aria-label="Achievement"
					/>
				) : (
					<BadgeIconGlyph icon={badge.icon ?? ""} className="size-12" />
				)}
			</motion.span>
		</div>
	);
}

// ─── Single Toast ─────────────────────────────────────────────────────────────

function ToastItem({ toast }: { toast: Toast }) {
	const { pauseAutoDismiss, resumeAutoDismiss } = useToast();
	// Only pause/resume auto-dismiss for toasts that use the timer (no actions, not loading)
	const canPauseOnHover =
		toast.state !== "loading" && !(toast.actions?.length ?? 0);
	const handleMouseEnter = () => {
		if (canPauseOnHover) pauseAutoDismiss(toast.id);
	};
	const handleMouseLeave = () => {
		if (canPauseOnHover) resumeAutoDismiss(toast.id, toast.duration ?? 3000);
	};

	if (toast.badge) {
		const hue = toast.badge.hue ?? DEFAULT_HUE;
		const isEpic = toast.badge.celebration === "epic";
		const isRare = toast.badge.celebration === "rare";
		const isStarAchievement =
			toast.badge.icon === "star" || toast.badge.icon === "";
		// Reference: dark pill, dashed gold border, gold badge, two-line text
		const borderHue = isStarAchievement ? GOLD_HUE : hue;

		return (
			<motion.div
				layout
				initial={{ opacity: 0, y: 20, scale: 0.9 }}
				animate={{ opacity: 1, y: 0, scale: 1 }}
				exit={{ opacity: 0, y: 8, scale: 0.96 }}
				transition={{ type: "spring", stiffness: 300, damping: 24 }}
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
				className="pointer-events-auto relative overflow-hidden rounded-full border border-dashed bg-zinc-900/95 p-2 pr-10 text-foreground shadow-[0_24px_70px_rgba(0,0,0,0.4)] backdrop-blur-xl"
				style={{
					borderColor: `oklch(0.55 0.12 ${borderHue} / 0.7)`,
				}}
			>
				{/* Top-edge category glow line */}
				<div
					className="pointer-events-none absolute inset-x-0 top-0 h-px"
					style={{
						background: `linear-gradient(90deg, transparent, oklch(0.65 0.16 ${borderHue} / 0.5), transparent)`,
					}}
				/>

				{/* Subtle radial ambient glow */}
				<div
					className="pointer-events-none absolute inset-0"
					style={{
						background: `radial-gradient(circle at left, oklch(0.55 0.10 ${borderHue} / 0.2), transparent 55%)`,
					}}
				/>

				{/* Horizontal shimmer sweep for rare/epic — single sweep on entrance */}
				{(isRare || isEpic) && (
					<motion.div
						className="pointer-events-none absolute inset-0"
						initial={{ x: "-100%" }}
						animate={{ x: "200%" }}
						transition={{
							delay: 0.3,
							duration: isEpic ? 1.2 : 0.9,
							ease: "easeInOut",
						}}
						style={{
							background: `linear-gradient(105deg, transparent 40%, oklch(0.80 0.10 ${borderHue} / 0.12) 50%, transparent 60%)`,
						}}
					/>
				)}

				<div className="relative flex items-center gap-3.5">
					<BadgeToastIcon badge={toast.badge} />
					<div className="min-w-0">
						{/* <p
							className="font-medium text-[11px] uppercase tracking-[0.22em]"
							style={{ color: `oklch(0.72 0.12 ${borderHue})` }}
						>
							Achievement unlocked
						</p> */}
						<p className="truncate font-semibold text-[15px] text-white">
							Achievement unlocked: {toast.badge.name}
						</p>
						<p className="text-xs text-zinc-400 [font-variant-numeric:tabular-nums]">
							+{toast.badge.xp} XP earned
						</p>
					</div>
				</div>
			</motion.div>
		);
	}

	return (
		<motion.div
			layout
			initial={{ opacity: 0, y: 12, scale: 0.95 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			exit={{ opacity: 0, y: 6, scale: 0.95 }}
			transition={{ type: "spring", stiffness: 380, damping: 28 }}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
			className={cn(
				"pointer-events-auto flex items-center gap-2.5 rounded-full px-3.5 py-2.5",
				toast.actions ? "pr-3.5" : "pr-5",
				"bg-foreground font-medium text-background shadow-lg",
				"text-sm",
			)}
		>
			{/* icon */}
			<span className="shrink-0">
				{toast.state === "loading" && <LoadingIcon />}
				{toast.state === "success" && <SuccessIcon />}
				{toast.state === "error" && <ErrorIcon />}
				{toast.state === "warn" && <WarnIcon />}
			</span>

			{/* morphing text */}
			<TextMorph className="whitespace-nowrap">{toast.message}</TextMorph>

			{/* inline action buttons */}
			{toast.actions && toast.actions.length > 0 && (
				<>
					{/* thin separator */}
					<span className="mx-0.5 h-4 w-px shrink-0 rounded-full bg-background/20" />
					<div className="flex items-center gap-1">
						{toast.actions.map((action) => (
							<button
								key={action.label}
								type="button"
								onClick={action.onClick}
								className={cn(
									"cursor-pointer select-none rounded-full px-2.5 py-1 font-medium text-xs transition-colors",
									action.variant === "primary"
										? "bg-background text-foreground hover:bg-background/90"
										: "text-background/60 hover:bg-background/15 hover:text-background",
								)}
							>
								{action.label}
							</button>
						))}
					</div>
				</>
			)}
		</motion.div>
	);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([]);
	const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

	const dismiss = useCallback((id: string) => {
		setToasts((prev) => prev.filter((t) => t.id !== id));
		const timer = timers.current.get(id);
		if (timer) {
			clearTimeout(timer);
			timers.current.delete(id);
		}
	}, []);

	const scheduleAutoDismiss = useCallback(
		(id: string, duration: number) => {
			const existing = timers.current.get(id);
			if (existing) clearTimeout(existing);
			const timer = setTimeout(() => dismiss(id), duration);
			timers.current.set(id, timer);
		},
		[dismiss],
	);

	const pauseAutoDismiss = useCallback((id: string) => {
		const timer = timers.current.get(id);
		if (timer) {
			clearTimeout(timer);
			timers.current.delete(id);
		}
	}, []);

	const resumeAutoDismiss = useCallback(
		(id: string, duration: number) => {
			scheduleAutoDismiss(id, duration);
		},
		[scheduleAutoDismiss],
	);

	const toast = useCallback(
		(
			message: string,
			state: ToastState = "success",
			duration = 3000,
			actions?: ToastAction[],
		) => {
			const id = crypto.randomUUID();
			setToasts((prev) => [...prev, { id, message, state, duration, actions }]);
			// toasts with action buttons stay until the user acts on them
			if (state !== "loading" && !actions?.length)
				scheduleAutoDismiss(id, duration);
			return id;
		},
		[scheduleAutoDismiss],
	);

	const celebrateBadge = useCallback(
		(badge: BadgeToast) => {
			const id = crypto.randomUUID();
			const duration =
				badge.celebration === "epic"
					? 5600
					: badge.celebration === "rare"
						? 4600
						: 3600;
			setToasts((prev) => [
				...prev,
				{
					id,
					message: `Unlocked ${badge.name}`,
					state: "success",
					duration,
					badge,
				},
			]);
			scheduleAutoDismiss(id, duration);
			return id;
		},
		[scheduleAutoDismiss],
	);

	const update = useCallback(
		(
			id: string,
			message: string,
			state: ToastState,
			actions?: ToastAction[],
		) => {
			setToasts((prev) =>
				prev.map((t) => (t.id === id ? { ...t, message, state, actions } : t)),
			);
			// toasts with action buttons stay until the user acts on them
			if (state !== "loading" && !actions?.length)
				scheduleAutoDismiss(id, 3000);
		},
		[scheduleAutoDismiss],
	);

	const promise = useCallback(
		async <T,>(
			p: Promise<T>,
			messages: { loading: string; success: string; error: string },
		): Promise<T> => {
			const id = toast(messages.loading, "loading");
			try {
				const result = await p;
				update(id, messages.success, "success");
				return result;
			} catch (err) {
				update(id, messages.error, "error");
				throw err;
			}
		},
		[toast, update],
	);

	// cleanup on unmount
	useEffect(() => {
		return () => {
			timers.current.forEach(clearTimeout);
		};
	}, []);

	return (
		<ToastContext.Provider
			value={{
				toast,
				celebrateBadge,
				update,
				dismiss,
				pauseAutoDismiss,
				resumeAutoDismiss,
				promise,
			}}
		>
			{children}
			{/* portal */}
			<div className="pointer-events-none fixed bottom-6 left-1/2 z-[9999] flex -translate-x-1/2 flex-col items-center gap-2">
				<AnimatePresence mode="popLayout">
					{toasts.map((t) => (
						<ToastItem key={t.id} toast={t} />
					))}
				</AnimatePresence>
			</div>
		</ToastContext.Provider>
	);
}
