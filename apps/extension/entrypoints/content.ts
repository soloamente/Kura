import { defineContentScript } from "wxt/utils/define-content-script";

export default defineContentScript({
	matches: ["<all_urls>"],
	runAt: "document_idle",

	main() {
		// ─── Toast styles ────────────────────────────────────────────────────────
		const TOAST_ID = "kura-toast";

		function showToast(
			message: string,
			type: "success" | "error" | "duplicate",
		) {
			let el = document.getElementById(TOAST_ID);
			if (el) el.remove();

			el = document.createElement("div");
			el.id = TOAST_ID;

			const colors = {
				success: { bg: "#18181b", dot: "#10b981" },
				error: { bg: "#18181b", dot: "#ef4444" },
				duplicate: { bg: "#18181b", dot: "#f59e0b" },
			};
			const c = colors[type];

			Object.assign(el.style, {
				position: "fixed",
				bottom: "24px",
				left: "50%",
				transform: "translateX(-50%) translateY(8px)",
				zIndex: "2147483647",
				display: "flex",
				alignItems: "center",
				gap: "8px",
				padding: "10px 16px",
				borderRadius: "9999px",
				background: c.bg,
				color: "#fff",
				fontSize: "13px",
				fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
				fontWeight: "500",
				boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
				opacity: "0",
				transition: "opacity 0.2s ease, transform 0.2s ease",
				pointerEvents: "none",
				userSelect: "none",
				whiteSpace: "nowrap",
			});

			// dot indicator
			const dot = document.createElement("span");
			Object.assign(dot.style, {
				width: "6px",
				height: "6px",
				borderRadius: "50%",
				background: c.dot,
				flexShrink: "0",
			});
			el.appendChild(dot);

			// message
			const text = document.createElement("span");
			text.textContent = message;
			el.appendChild(text);

			document.body.appendChild(el);

			// animate in
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					if (el) {
						el.style.opacity = "1";
						el.style.transform = "translateX(-50%) translateY(0)";
					}
				});
			});

			// auto-dismiss
			setTimeout(() => {
				if (el) {
					el.style.opacity = "0";
					el.style.transform = "translateX(-50%) translateY(8px)";
					setTimeout(() => el?.remove(), 300);
				}
			}, 2500);
		}

		// ─── Listen for messages from background ─────────────────────────────────
		browser.runtime.onMessage.addListener((msg) => {
			if (msg.type !== "kura:saved") return;
			if (msg.status === "success") {
				showToast("Saved to Kura", "success");
			} else if (msg.status === "duplicate") {
				showToast("Already in Kura", "duplicate");
			} else if (msg.status === "error") {
				showToast("Failed to save", "error");
			}
		});
	},
});
