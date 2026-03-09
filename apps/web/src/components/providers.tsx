"use client";

import { Toaster } from "@Kura/ui/components/sonner";
import { DialRoot } from "dialkit";
import "dialkit/styles.css";

import { Agentation } from "agentation";

import { ThemeProvider } from "./theme-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
	return (
		<ThemeProvider
			attribute="class"
			defaultTheme="system"
			enableSystem
			disableTransitionOnChange
		>
			{children}
			<Toaster richColors />
			{process.env.NODE_ENV === "development" && (
				<>
					<Agentation />
					<DialRoot position="top-right" />
				</>
			)}
		</ThemeProvider>
	);
}
