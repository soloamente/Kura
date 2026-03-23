"use client";

import { useToast } from "@Kura/ui/components/toast";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

function slugify(value: string) {
	return value
		.toLowerCase()
		.replace(/\s+/g, "_")
		.replace(/[^a-z0-9_]/g, "")
		.slice(0, 24);
}

export function UsernameOnboarding({
	name,
	onComplete,
}: {
	name: string;
	onComplete: () => void;
}) {
	const { toast } = useToast();
	const [username, setUsername] = useState(() => slugify(name));
	const [status, setStatus] = useState<
		"idle" | "checking" | "taken" | "available" | "saving"
	>("idle");
	const inputRef = useRef<HTMLInputElement>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		inputRef.current?.focus();
		inputRef.current?.select();
	}, []);

	useEffect(() => {
		if (!username || username.length < 2) {
			setStatus("idle");
			return;
		}

		setStatus("checking");
		if (debounceRef.current) clearTimeout(debounceRef.current);

		debounceRef.current = setTimeout(async () => {
			// check availability via the PATCH endpoint dry-run — just fetch the profile
			const res = await fetch(
				`${process.env.NEXT_PUBLIC_SERVER_URL}/users/${username}`,
				{ credentials: "include" },
			);
			// 404 means available, 200 means taken
			setStatus(res.status === 404 ? "available" : "taken");
		}, 400);

		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, [username]);

	const handleSubmit = async () => {
		if (status !== "available" && status !== "idle") return;
		if (username.length < 2) return;

		setStatus("saving");
		const { error } = await api.users.me.patch({ username });
		if (error) {
			toast("Failed to save username", "error");
			setStatus("available");
			return;
		}
		onComplete();
	};

	const isValid = username.length >= 2;
	// Only allow submit when not checking/taken/saving — narrowed to available|idle here
	const canSubmit =
		isValid && (status === "available" || status === "idle");

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
			<motion.div
				className="flex w-full max-w-sm flex-col gap-8 px-6"
				initial={{ opacity: 0, y: 16 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.3, ease: [0.215, 0.61, 0.355, 1] }}
			>
				{/* wordmark */}
				<div className="flex flex-col gap-1">
					<p className="font-bold text-3xl text-foreground tracking-tight">
						Welcome to Kura
					</p>
					<p className="text-muted-foreground text-sm">
						Pick a username so others can find you.
					</p>
				</div>

				{/* input */}
				<div className="flex flex-col gap-3">
					<div className="relative flex items-center">
						<span className="pointer-events-none absolute left-3.5 select-none text-muted-foreground text-sm">
							kura.app/
						</span>
						<input
							ref={inputRef}
							type="text"
							value={username}
							onChange={(e) => setUsername(slugify(e.target.value))}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleSubmit();
							}}
							placeholder="username"
							maxLength={24}
							spellCheck={false}
							autoComplete="off"
							className="h-11 w-full rounded-xl border border-border bg-muted/40 pr-10 pl-[5.5rem] text-foreground text-sm transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
						/>
						{/* status indicator */}
						<span className="absolute right-3.5">
							<AnimatePresence mode="wait">
								{status === "checking" && (
									<motion.svg
										key="checking"
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
										initial={{ opacity: 0 }}
										exit={{ opacity: 0 }}
									>
										<circle
											cx="7"
											cy="7"
											r="5.5"
											stroke="currentColor"
											strokeWidth="1.5"
											strokeLinecap="round"
											strokeDasharray="22 12"
											className="text-muted-foreground/40"
										/>
									</motion.svg>
								)}
								{status === "available" && (
									<motion.svg
										key="available"
										width="14"
										height="14"
										viewBox="0 0 14 14"
										fill="none"
										initial={{ opacity: 0, scale: 0.7 }}
										animate={{ opacity: 1, scale: 1 }}
										exit={{ opacity: 0 }}
										transition={{ type: "spring", stiffness: 400, damping: 20 }}
									>
										<circle
											cx="7"
											cy="7"
											r="6"
											fill="currentColor"
											className="text-emerald-500"
										/>
										<path
											d="M4 7l2 2 4-4"
											stroke="white"
											strokeWidth="1.5"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
									</motion.svg>
								)}
								{status === "taken" && (
									<motion.svg
										key="taken"
										width="14"
										height="14"
										viewBox="0 0 14 14"
										fill="none"
										initial={{ opacity: 0, scale: 0.7 }}
										animate={{ opacity: 1, scale: 1 }}
										exit={{ opacity: 0 }}
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
								)}
							</AnimatePresence>
						</span>
					</div>

					{/* hint text */}
					<AnimatePresence mode="wait">
						{status === "taken" && (
							<motion.p
								key="taken"
								className="text-destructive text-xs"
								initial={{ opacity: 0, y: -4 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0 }}
							>
								That username is taken. Try another.
							</motion.p>
						)}
						{status === "available" && (
							<motion.p
								key="available"
								className="text-emerald-500 text-xs"
								initial={{ opacity: 0, y: -4 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0 }}
							>
								kura.app/{username} is yours!
							</motion.p>
						)}
						{status === "idle" &&
							username.length > 0 &&
							username.length < 2 && (
								<motion.p
									key="short"
									className="text-muted-foreground text-xs"
									initial={{ opacity: 0, y: -4 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0 }}
								>
									Username must be at least 2 characters.
								</motion.p>
							)}
					</AnimatePresence>
				</div>

				<button
					type="button"
					onClick={handleSubmit}
					disabled={!canSubmit}
					className="h-11 w-full rounded-xl bg-primary font-semibold text-primary-foreground text-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
				>
					{status === "saving" ? "Saving…" : "Continue"}
				</button>

				<p className="text-center text-muted-foreground text-xs">
					You can change this later in settings.
				</p>
			</motion.div>
		</div>
	);
}
