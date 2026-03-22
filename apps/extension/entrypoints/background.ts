import { defineBackground } from "wxt/utils/define-background";

const API = "https://app.kura.so"; // swap for localhost in dev
// Allow overriding via storage for dev builds
async function getApiBase(): Promise<string> {
	const result = await browser.storage.local.get("kura_api_base");
	return (result.kura_api_base as string) || API;
}

async function saveUrl(
	url: string,
	title: string,
	collectionId?: string | null,
) {
	const base = await getApiBase();
	const res = await fetch(`${base}/bookmarks`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify({ url, title, collectionId: collectionId ?? null }),
	});
	if (res.status === 409) {
		const data = await res.json();
		return { duplicate: true, bookmark: data.bookmark };
	}
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return { duplicate: false, bookmark: await res.json() };
}

async function setBadge(text: string, color: string) {
	await browser.action.setBadgeText({ text });
	await browser.action.setBadgeBackgroundColor({ color });
}

export default defineBackground(() => {
	// ─── Context menu ──────────────────────────────────────────────────────────
	browser.runtime.onInstalled.addListener(() => {
		browser.contextMenus.create({
			id: "kura-save-page",
			title: "Save page to Kura",
			contexts: ["page"],
		});
		browser.contextMenus.create({
			id: "kura-save-link",
			title: "Save link to Kura",
			contexts: ["link"],
		});
	});

	browser.contextMenus.onClicked.addListener(async (info, tab) => {
		const url =
			info.menuItemId === "kura-save-link"
				? info.linkUrl
				: (info.pageUrl ?? tab?.url);
		const title =
			info.menuItemId === "kura-save-link"
				? (info.linkUrl ?? "")
				: (tab?.title ?? "");
		if (!url) return;

		try {
			await setBadge("...", "#6b7280");
			const result = await saveUrl(url, title);
			if (result.duplicate) {
				await setBadge("!", "#f59e0b");
			} else {
				await setBadge("✓", "#10b981");
			}
		} catch {
			await setBadge("✗", "#ef4444");
		}

		// clear badge after 2s
		setTimeout(() => setBadge("", "#6b7280"), 2000);
	});

	// ─── Keyboard shortcut ─────────────────────────────────────────────────────
	browser.commands.onCommand.addListener(async (command) => {
		if (command !== "save-page") return;
		const [tab] = await browser.tabs.query({
			active: true,
			currentWindow: true,
		});
		if (!tab?.url || !tab.id) return;

		try {
			await setBadge("...", "#6b7280");
			const result = await saveUrl(tab.url, tab.title ?? "");
			if (result.duplicate) {
				await setBadge("!", "#f59e0b");
				// notify content script so it can show a toast
				browser.tabs
					.sendMessage(tab.id, {
						type: "kura:saved",
						status: "duplicate",
						url: tab.url,
					})
					.catch(() => {});
			} else {
				await setBadge("✓", "#10b981");
				browser.tabs
					.sendMessage(tab.id, {
						type: "kura:saved",
						status: "success",
						url: tab.url,
					})
					.catch(() => {});
			}
		} catch (err) {
			await setBadge("✗", "#ef4444");
			const [activeTab] = await browser.tabs.query({
				active: true,
				currentWindow: true,
			});
			if (activeTab?.id) {
				browser.tabs
					.sendMessage(activeTab.id, {
						type: "kura:saved",
						status: "error",
					})
					.catch(() => {});
			}
		}

		setTimeout(() => setBadge("", "#6b7280"), 2000);
	});

	// ─── Message from popup: save with collection ──────────────────────────────
	browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
		if (msg.type === "kura:save") {
			saveUrl(msg.url, msg.title ?? "", msg.collectionId)
				.then((result) => sendResponse({ ok: true, ...result }))
				.catch((err) => sendResponse({ ok: false, error: String(err) }));
			return true; // keep channel open for async response
		}
		if (msg.type === "kura:save-force") {
			getApiBase().then(async (base) => {
				try {
					const res = await fetch(`${base}/bookmarks/force`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						credentials: "include",
						body: JSON.stringify({
							url: msg.url,
							title: msg.title,
							collectionId: msg.collectionId ?? null,
						}),
					});
					const data = await res.json();
					sendResponse({ ok: res.ok, bookmark: data });
				} catch (err) {
					sendResponse({ ok: false, error: String(err) });
				}
			});
			return true;
		}
	});
});
