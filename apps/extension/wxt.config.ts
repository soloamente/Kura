import { defineConfig } from "wxt";

export default defineConfig({
	modules: ["@wxt-dev/module-react"],
	manifest: {
		name: "Kura",
		description: "Save links to your Kura library",
		permissions: ["activeTab", "contextMenus", "storage", "tabs"],
		host_permissions: ["<all_urls>"],
		commands: {
			"save-page": {
				suggested_key: {
					default: "Alt+Shift+S",
					mac: "Alt+Shift+S",
				},
				description: "Save current page to Kura",
			},
		},
		action: {
			default_title: "Save to Kura",
			default_popup: "popup.html",
		},
		// Note: we open `options.html` via `tabs.create` + `runtime.getURL` from the popup. WXT’s
		// manifest merge drops `options_ui.open_in_tab`, which makes `runtime.openOptionsPage()`
		// throw "Could not create an options page" in Chrome MV3 when embedded options fail.
	},
});
