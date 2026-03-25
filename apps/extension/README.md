# Kura browser extension

## API and web URLs

Extension API calls must hit the **Hono server** (same host as `NEXT_PUBLIC_SERVER_URL` on the web app) so session cookies work. Login and “open Kura” links go to the **Next.js** deployment.

For local dev, defaults are `http://localhost:3000` (API) and `http://localhost:3001` (web).

For production builds (`wxt build` / `wxt zip`), set env vars or copy `.env.example` to `.env.production`:

- `WXT_PUBLIC_API_URL` — API origin, e.g. `https://kura-server.vercel.app`
- `WXT_PUBLIC_WEB_URL` — web app origin, e.g. `https://kura-web.vercel.app`

Per-browser override: `chrome.storage.local` key `kura_api_base` still overrides the API origin (useful for staging).

## Popup appearance

Settings are stored in **`chrome.storage.local`** under `kura_popup_appearance` (older builds may migrate once from `sync`). Open **Appearance** from the popup (**gear** in the header); it opens `appearance.html` in a new tab (`runtime.getURL`).

- **Theme / controls / spacing** — `--radius` / `--radius-sm` affect buttons and chips **inside** the popup. The **toolbar panel itself stays rectangular** (Chrome does not expose a reliable way to round the extension popup window).
- **Popup contents** — toggles: **Current page**, **Collections** (Inbox + chips), **Recent** list.

The appearance page lives under `entrypoints/appearance/` (not WXT’s `options` entrypoint) so the manifest does not use `options_ui` (avoids Chrome `openOptionsPage` issues).
