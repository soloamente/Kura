import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import "./style.css";

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = "http://localhost:3000"; // prod default

async function getApiBase(): Promise<string> {
	const result = await browser.storage.local.get("kura_api_base");
	return (result.kura_api_base as string) || API_BASE;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Collection {
	id: string;
	name: string;
}
interface Bookmark {
	id: string;
	url: string;
	title: string | null;
	favicon: string | null;
	createdAt: string;
}
interface User {
	id: string;
	name: string;
	email: string;
	image: string | null;
}

type SaveStatus = "idle" | "saving" | "saved" | "duplicate" | "error";

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch(path: string, options?: RequestInit) {
	const base = await getApiBase();
	return fetch(`${base}${path}`, {
		...options,
		credentials: "include",
		headers: { "Content-Type": "application/json", ...options?.headers },
	});
}

// ─── Favicon ──────────────────────────────────────────────────────────────────

function Favicon({ url, size = 16 }: { url: string; size?: number }) {
	const [error, setError] = useState(false);
	const src = `https://www.google.com/s2/favicons?domain=${new URL(url).origin}&sz=32`;
	if (error)
		return (
			<span
				className="favicon-fallback"
				style={{ width: size, height: size }}
			/>
		);
	return (
		<img
			src={src}
			width={size}
			height={size}
			alt=""
			onError={() => setError(true)}
			style={{ borderRadius: 3, flexShrink: 0 }}
		/>
	);
}

// ─── Login wall ───────────────────────────────────────────────────────────────

function LoginWall() {
	return (
		<div className="login-wall">
			<div className="logo">Kura</div>
			<p className="login-message">Sign in to save bookmarks</p>
			<button
				type="button"
				className="btn-primary"
				onClick={() =>
					browser.tabs.create({ url: "https://app.kura.so/login" })
				}
			>
				Open Kura to sign in
			</button>
		</div>
	);
}

// ─── Save status icon ─────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: SaveStatus }) {
	if (status === "saving") {
		return (
			<svg
				className="spin"
				width="16"
				height="16"
				viewBox="0 0 16 16"
				fill="none"
			>
				<circle
					cx="8"
					cy="8"
					r="6"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeDasharray="24 14"
					strokeLinecap="round"
				/>
			</svg>
		);
	}
	if (status === "saved") {
		return (
			<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
				<circle cx="8" cy="8" r="7" fill="#10b981" />
				<path
					d="M4.5 8l2.5 2.5 4.5-4.5"
					stroke="white"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		);
	}
	if (status === "duplicate") {
		return (
			<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
				<circle cx="8" cy="8" r="7" fill="#f59e0b" />
				<path
					d="M8 5v4M8 11v.5"
					stroke="white"
					strokeWidth="1.5"
					strokeLinecap="round"
				/>
			</svg>
		);
	}
	if (status === "error") {
		return (
			<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
				<circle cx="8" cy="8" r="7" fill="#ef4444" />
				<path
					d="M5.5 5.5l5 5M10.5 5.5l-5 5"
					stroke="white"
					strokeWidth="1.5"
					strokeLinecap="round"
				/>
			</svg>
		);
	}
	return null;
}

// ─── Main popup ───────────────────────────────────────────────────────────────

function Popup() {
	const [user, setUser] = useState<User | null | "loading">("loading");
	const [tab, setTab] = useState<{ url: string; title: string } | null>(null);
	const [collections, setCollections] = useState<Collection[]>([]);
	const [recent, setRecent] = useState<Bookmark[]>([]);
	const [selectedCollection, setSelectedCollection] = useState<string | null>(
		null,
	);
	const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
	const [duplicateUrl, setDuplicateUrl] = useState<string | null>(null);
	const [isAlreadySaved, setIsAlreadySaved] = useState(false);
	const [loadingRecent, setLoadingRecent] = useState(true);

	// ─── Init ────────────────────────────────────────────────────────────────
	useEffect(() => {
		// get current tab
		browser.tabs.query({ active: true, currentWindow: true }).then(([t]) => {
			if (t?.url) setTab({ url: t.url, title: t.title ?? t.url });
		});

		// check auth
		apiFetch("/users/me")
			.then(async (res) => {
				if (!res.ok) {
					setUser(null);
					return;
				}
				setUser(await res.json());
			})
			.catch(() => setUser(null));
	}, []);

	// ─── Load collections + recent once authed ────────────────────────────────
	useEffect(() => {
		if (!user || user === "loading") return;

		apiFetch("/collections")
			.then(async (res) => {
				if (!res.ok) return;
				const data = await res.json();
				if (Array.isArray(data))
					setCollections(
						data.map((c: Collection) => ({ id: c.id, name: c.name })),
					);
			})
			.catch(() => {});

		apiFetch("/bookmarks?limit=8")
			.then(async (res) => {
				if (!res.ok) return;
				const data = await res.json();
				if (Array.isArray(data)) setRecent(data.slice(0, 8));
			})
			.catch(() => {})
			.finally(() => setLoadingRecent(false));
	}, [user]);

	// ─── Check if current tab is already saved ────────────────────────────────
	useEffect(() => {
		if (!tab?.url || !user || user === "loading") return;
		// simple client-side check against recent list
		setIsAlreadySaved(recent.some((b) => b.url === tab.url));
	}, [recent, tab, user]);

	// ─── Save ─────────────────────────────────────────────────────────────────
	const handleSave = async (force = false) => {
		if (!tab) return;
		setSaveStatus("saving");
		setDuplicateUrl(null);

		const msg = force
			? {
					type: "kura:save-force",
					url: tab.url,
					title: tab.title,
					collectionId: selectedCollection,
				}
			: {
					type: "kura:save",
					url: tab.url,
					title: tab.title,
					collectionId: selectedCollection,
				};

		const res = await browser.runtime.sendMessage(msg);

		if (!res.ok) {
			setSaveStatus("error");
			setTimeout(() => setSaveStatus("idle"), 2500);
			return;
		}
		if (res.duplicate) {
			setSaveStatus("duplicate");
			setDuplicateUrl(tab.url);
			return;
		}

		setSaveStatus("saved");
		setIsAlreadySaved(true);
		// prepend to recent
		if (res.bookmark) {
			setRecent((prev) => [res.bookmark, ...prev].slice(0, 8));
		}
		setTimeout(() => setSaveStatus("idle"), 2000);
	};

	// ─── Render ───────────────────────────────────────────────────────────────

	if (user === "loading") {
		return (
			<div className="popup loading-state">
				<div className="skeleton" style={{ width: "60%", height: 14 }} />
				<div className="skeleton" style={{ width: "40%", height: 12 }} />
			</div>
		);
	}

	if (!user) return <LoginWall />;

	const isSaving = saveStatus === "saving";

	return (
		<div className="popup">
			{/* ── Header ── */}
			<div className="header">
				<span className="logo-sm">Kura</span>
				<button
					type="button"
					className="header-btn"
					title="Open Kura"
					onClick={() => browser.tabs.create({ url: "https://app.kura.so" })}
				>
					<svg width="13" height="13" viewBox="0 0 13 13" fill="none">
						<path
							d="M2 2h4v1H3v7h7V8h1v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm5 0h4v4h-1V3.707L6.854 6.854l-.708-.708L9.293 3H7V2z"
							fill="currentColor"
						/>
					</svg>
				</button>
			</div>

			{/* ── Current page ── */}
			{tab && (
				<div className="current-page">
					<div className="page-info">
						<Favicon url={tab.url} size={14} />
						<span className="page-title">{tab.title}</span>
					</div>
					<span className="page-domain">
						{new URL(tab.url).hostname.replace("www.", "")}
					</span>
				</div>
			)}

			{/* ── Collection picker ── */}
			{collections.length > 0 && (
				<div className="collection-picker">
					<button
						type="button"
						className={`collection-chip ${selectedCollection === null ? "active" : ""}`}
						onClick={() => setSelectedCollection(null)}
					>
						Inbox
					</button>
					{collections.map((c) => (
						<button
							key={c.id}
							type="button"
							className={`collection-chip ${selectedCollection === c.id ? "active" : ""}`}
							onClick={() => setSelectedCollection(c.id)}
						>
							{c.name}
						</button>
					))}
				</div>
			)}

			{/* ── Save button ── */}
			{saveStatus === "duplicate" && duplicateUrl ? (
				<div className="duplicate-notice">
					<StatusIcon status="duplicate" />
					<span>Already saved — save again?</span>
					<div className="duplicate-actions">
						<button
							type="button"
							className="btn-ghost"
							onClick={() => {
								setSaveStatus("idle");
								setDuplicateUrl(null);
							}}
						>
							Cancel
						</button>
						<button
							type="button"
							className="btn-primary-sm"
							onClick={() => handleSave(true)}
						>
							Save again
						</button>
					</div>
				</div>
			) : (
				<button
					type="button"
					className={`save-btn ${saveStatus === "saved" ? "saved" : ""} ${isAlreadySaved && saveStatus === "idle" ? "already-saved" : ""}`}
					onClick={() => handleSave(false)}
					disabled={isSaving || saveStatus === "saved"}
				>
					<StatusIcon status={saveStatus} />
					{saveStatus === "saving" && "Saving…"}
					{saveStatus === "saved" && "Saved!"}
					{saveStatus === "error" && "Failed — try again"}
					{saveStatus === "idle" &&
						(isAlreadySaved ? "Save again" : "Save to Kura")}
				</button>
			)}

			{/* ── Recent bookmarks ── */}
			<div className="recent-section">
				<p className="recent-label">Recent</p>
				{loadingRecent ? (
					<div className="recent-list">
						{[0.9, 0.7, 0.8, 0.6].map((o, i) => (
							<div key={i} className="skeleton-row" style={{ opacity: o }}>
								<div
									className="skeleton"
									style={{ width: 14, height: 14, borderRadius: 3 }}
								/>
								<div className="skeleton" style={{ flex: 1, height: 12 }} />
							</div>
						))}
					</div>
				) : recent.length === 0 ? (
					<p className="recent-empty">No bookmarks yet</p>
				) : (
					<div className="recent-list">
						{recent.map((b) => (
							<button
								key={b.id}
								type="button"
								className="recent-item"
								onClick={() => browser.tabs.create({ url: b.url })}
								title={b.url}
							>
								<Favicon url={b.url} size={13} />
								<span className="recent-title">{b.title ?? b.url}</span>
							</button>
						))}
					</div>
				)}
			</div>

			{/* ── Footer ── */}
			<div className="footer">
				<span className="footer-user">{(user as User).name}</span>
				<button
					type="button"
					className="footer-link"
					onClick={() =>
						browser.tabs.create({ url: "https://app.kura.so/settings" })
					}
				>
					Settings
				</button>
			</div>
		</div>
	);
}

// ─── Mount ────────────────────────────────────────────────────────────────────

ReactDOM.createRoot(document.getElementById("root")!).render(<Popup />);
