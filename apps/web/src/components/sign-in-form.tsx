"use client";

import { useToast } from "@Kura/ui/components/toast";
import { useForm } from "@tanstack/react-form";
import { Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import type { ChangeEvent } from "react";
import z from "zod";
import { authClient } from "@/lib/auth-client";

export default function SignInForm({
	onSwitchToSignUp,
}: {
	onSwitchToSignUp: () => void;
}) {
	const router = useRouter();
	const { toast } = useToast();

	// Avoid authClient.useSession() in SignInForm on this stack (Next 16, React 19, Turbopack)
	// to prevent "selector is not a function"; render form without session check.
	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			try {
				await authClient.signIn.email(
					{
						email: value.email,
						password: value.password,
					},
					{
						onSuccess: () => {
							router.push("/dashboard");
							toast("Sign in successful", "success");
						},
						onError: (error) => {
							toast(error.error.message || error.error.statusText, "error");
						},
					},
				);
			} catch (error) {
				console.error("Unexpected sign in error:", error);
			}
		},
		validators: {
			onSubmit: z.object({
				email: z.email("Invalid email address"),
				password: z.string().min(8, "Password must be at least 8 characters"),
			}),
		},
	});

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ duration: 0.2 }}
			className="mx-auto w-full max-w-sm"
		>
			<h1 className="mb-10 text-center font-semibold text-3xl">Welcome Back</h1>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
				className="space-y-3"
			>
				<div>
					<form.Field
						name="email"
						validators={{
							onChange: z
								.string()
								.min(1, "Email is required")
								.email("Invalid email address"),
						}}
					>
						{(field) => (
							<div>
								<motion.input
									id={field.name}
									name={field.name}
									type="email"
									value={field.state.value}
									onBlur={field.handleBlur}
									placeholder="jane@example.com"
									className="w-full rounded-2xl bg-input/30 px-3.75 py-3.25 font-medium leading-none transition-colors placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
									onChange={(e: ChangeEvent<HTMLInputElement>) =>
										field.handleChange(e.target.value)
									}
									whileFocus={{ scale: 1.01 }}
									transition={{ duration: 0.2 }}
									style={{ willChange: "transform" }}
								/>
								<AnimatePresence mode="wait">
									{field.state.meta.errors.length > 0 && (
										<motion.div
											initial={{ opacity: 0, height: 0, marginTop: 0 }}
											animate={{ opacity: 1, height: "auto", marginTop: 4 }}
											exit={{ opacity: 0, height: 0, marginTop: 0 }}
											transition={{ duration: 0.2 }}
											className="overflow-hidden"
										>
											<motion.p
												initial={{ opacity: 0 }}
												animate={{ opacity: 1 }}
												exit={{ opacity: 0 }}
												transition={{ duration: 0.15 }}
												className="text-red-500 text-sm"
											>
												{field.state.meta.errors[0]?.message}
											</motion.p>
										</motion.div>
									)}
								</AnimatePresence>
							</div>
						)}
					</form.Field>
				</div>

				<div>
					<form.Field
						name="password"
						validators={{
							onChange: z.string().min(1, "Password is required"),
						}}
					>
						{(field) => (
							<div>
								<motion.input
									id={field.name}
									name={field.name}
									type="password"
									value={field.state.value}
									onBlur={field.handleBlur}
									placeholder="jane123"
									className="w-full rounded-2xl bg-input/30 px-3.75 py-3.25 font-medium leading-none transition-colors placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
									onChange={(e: ChangeEvent<HTMLInputElement>) =>
										field.handleChange(e.target.value)
									}
									whileFocus={{ scale: 1.01 }}
									transition={{ duration: 0.2 }}
									style={{ willChange: "transform" }}
								/>
								<AnimatePresence mode="wait">
									{field.state.meta.errors.length > 0 && (
										<motion.div
											initial={{ opacity: 0, height: 0, marginTop: 0 }}
											animate={{ opacity: 1, height: "auto", marginTop: 4 }}
											exit={{ opacity: 0, height: 0, marginTop: 0 }}
											transition={{ duration: 0.2 }}
											className="overflow-hidden"
										>
											<motion.p
												initial={{ opacity: 0 }}
												animate={{ opacity: 1 }}
												exit={{ opacity: 0 }}
												transition={{ duration: 0.15 }}
												className="text-red-500 text-sm"
											>
												{field.state.meta.errors[0]?.message}
											</motion.p>
										</motion.div>
									)}
								</AnimatePresence>
							</div>
						)}
					</form.Field>
				</div>

				<form.Subscribe
					selector={(state) => ({
						values: state.values,
						isSubmitting: state.isSubmitting,
					})}
				>
					{(state) => {
						const isEmailEmpty =
							!state.values.email || state.values.email.trim() === "";
						const isPasswordEmpty =
							!state.values.password || state.values.password.trim() === "";
						const isDisabled =
							state.isSubmitting || isEmailEmpty || isPasswordEmpty;

						return (
							<motion.button
								type="submit"
								className="flex w-full cursor-pointer items-center justify-center rounded-2xl bg-primary px-4 py-2.75 font-medium text-primary-foreground transition-opacity duration-300 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
								disabled={isDisabled}
								whileHover={!isDisabled ? { scale: 1.01 } : undefined}
								whileTap={!isDisabled ? { scale: 0.98 } : undefined}
								transition={{ duration: 0.2 }}
								style={{ willChange: "transform" }}
							>
								<div className="flex h-5 items-center justify-center">
									<AnimatePresence mode="wait" initial={false}>
										{state.isSubmitting ? (
											<motion.div
												key="spinner"
												initial={{ opacity: 0, scale: 0.8 }}
												animate={{ opacity: 1, scale: 1 }}
												exit={{ opacity: 0, scale: 0.8 }}
												transition={{ duration: 0.2 }}
												className="flex items-center justify-center"
											>
												<Loader2 className="size-5 animate-spin text-primary-foreground" />
											</motion.div>
										) : (
											<motion.span
												key="text"
												initial={{ opacity: 0, scale: 0.8 }}
												animate={{ opacity: 1, scale: 1 }}
												exit={{ opacity: 0, scale: 0.8 }}
												transition={{ duration: 0.2 }}
												className="leading-none"
											>
												Login
											</motion.span>
										)}
									</AnimatePresence>
								</div>
							</motion.button>
						);
					}}
				</form.Subscribe>
			</form>

			<div className="mt-4 text-center text-sm">
				<span className="text-muted-foreground">
					Don&apos;t have an account?{" "}
				</span>
				<button
					type="button"
					onClick={onSwitchToSignUp}
					className="h-auto cursor-pointer text-primary underline-offset-2 hover:underline"
				>
					Create an account
				</button>
			</div>
		</motion.div>
	);
}
