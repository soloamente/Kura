"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";

export default function LoginPage() {
	const [showSignIn, setShowSignIn] = useState(true);

	return (
		<div className="flex flex-1 items-center justify-center px-4">
			<AnimatePresence mode="wait">
				{showSignIn ? (
					<motion.div
						key="signin"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						className="w-full"
					>
						<SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
					</motion.div>
				) : (
					<motion.div
						key="signup"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						className="w-full"
					>
						<SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
