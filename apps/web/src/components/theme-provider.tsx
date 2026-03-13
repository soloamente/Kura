"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ThemeName =
	| "default"
	| "nord"
	| "rose"
	| "midnight"
	| "forest"
	| "amber"
	| "mono";

export type ColorMode = "light" | "dark" | "system";
export type Density = "compact" | "comfortable";

export interface ThemePreferences {
	theme: ThemeName;
	colorMode: ColorMode;
	density: Density;
	// custom accent hue (0-360) — overrides the theme's primary hue when set
	accentHue: number | null;
}

interface ThemeContextValue extends ThemePreferences {
	setTheme: (theme: ThemeName) => void;
	setColorMode: (mode: ColorMode) => void;
	setDensity: (density: Density) => void;
	setAccentHue: (hue: number | null) => void;
	resolvedColorMode: "light" | "dark";
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULTS: ThemePreferences = {
	theme: "default",
	colorMode: "system",
	density: "comfortable",
	accentHue: null,
};

const STORAGE_KEY = "kura-theme-prefs";

function load(): ThemePreferences {
	if (typeof window === "undefined") return DEFAULTS;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return DEFAULTS;
		return { ...DEFAULTS, ...JSON.parse(raw) };
	} catch {
		return DEFAULTS;
	}
}

function save(prefs: ThemePreferences) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
	} catch {}
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue>({
	...DEFAULTS,
	resolvedColorMode: "light",
	setTheme: () => {},
	setColorMode: () => {},
	setDensity: () => {},
	setAccentHue: () => {},
});

export function useTheme() {
	return useContext(ThemeContext);
}

// ─── Apply to DOM ─────────────────────────────────────────────────────────────

const THEME_CLASSES: ThemeName[] = [
	"default",
	"nord",
	"rose",
	"midnight",
	"forest",
	"amber",
	"mono",
];

function applyToDom(prefs: ThemePreferences, resolved: "light" | "dark") {
	const html = document.documentElement;

	// remove all theme classes
	for (const t of THEME_CLASSES) {
		if (t !== "default") html.classList.remove(`theme-${t}`);
	}
	// apply current theme
	if (prefs.theme !== "default") {
		html.classList.add(`theme-${prefs.theme}`);
	}

	// dark / light
	html.classList.toggle("dark", resolved === "dark");

	// density
	html.dataset.density = prefs.density;

	// custom accent hue
	if (prefs.accentHue !== null) {
		// override primary with custom hue at same chroma/lightness
		const isDark = resolved === "dark";
		const l = isDark ? 0.75 : 0.45;
		const c = 0.18;
		html.style.setProperty("--primary", `oklch(${l} ${c} ${prefs.accentHue})`);
		html.style.setProperty(
			"--primary-foreground",
			isDark ? "oklch(0.13 0 0)" : "oklch(0.99 0 0)",
		);
		html.style.setProperty("--ring", `oklch(${l} ${c} ${prefs.accentHue})`);
	} else {
		html.style.removeProperty("--primary");
		html.style.removeProperty("--primary-foreground");
		html.style.removeProperty("--ring");
	}
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [prefs, setPrefs] = useState<ThemePreferences>(DEFAULTS);
	const [resolvedColorMode, setResolvedColorMode] = useState<"light" | "dark">(
		"light",
	);
	const [mounted, setMounted] = useState(false);

	// resolve system preference
	const resolveColorMode = useCallback((mode: ColorMode): "light" | "dark" => {
		if (mode === "system") {
			return window.matchMedia("(prefers-color-scheme: dark)").matches
				? "dark"
				: "light";
		}
		return mode;
	}, []);

	// initial load
	useEffect(() => {
		const loaded = load();
		const resolved = resolveColorMode(loaded.colorMode);
		setPrefs(loaded);
		setResolvedColorMode(resolved);
		applyToDom(loaded, resolved);
		setMounted(true);
	}, [resolveColorMode]);

	// listen for system preference changes
	useEffect(() => {
		if (prefs.colorMode !== "system") return;
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		const handler = () => {
			const resolved = resolveColorMode("system");
			setResolvedColorMode(resolved);
			applyToDom(prefs, resolved);
		};
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, [prefs, resolveColorMode]);

	const update = useCallback(
		(patch: Partial<ThemePreferences>) => {
			setPrefs((prev) => {
				const next = { ...prev, ...patch };
				const resolved = resolveColorMode(next.colorMode);
				setResolvedColorMode(resolved);
				applyToDom(next, resolved);
				save(next);
				return next;
			});
		},
		[resolveColorMode],
	);

	const setTheme = useCallback(
		(theme: ThemeName) => update({ theme }),
		[update],
	);
	const setColorMode = useCallback(
		(colorMode: ColorMode) => update({ colorMode }),
		[update],
	);
	const setDensity = useCallback(
		(density: Density) => update({ density }),
		[update],
	);
	const setAccentHue = useCallback(
		(accentHue: number | null) => update({ accentHue }),
		[update],
	);

	// prevent flash of wrong theme — render children only after mount
	if (!mounted) return null;

	return (
		<ThemeContext.Provider
			value={{
				...prefs,
				resolvedColorMode,
				setTheme,
				setColorMode,
				setDensity,
				setAccentHue,
			}}
		>
			{children}
		</ThemeContext.Provider>
	);
}

// ─── Inline script to prevent FOUC ───────────────────────────────────────────
// Inject this in <head> before any CSS loads

export const themeScript = `
(function() {
  try {
    var prefs = JSON.parse(localStorage.getItem('kura-theme-prefs') || '{}');
    var theme = prefs.theme || 'default';
    var mode = prefs.colorMode || 'system';
    var html = document.documentElement;
    if (theme !== 'default') html.classList.add('theme-' + theme);
    var dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) html.classList.add('dark');
    if (prefs.density) html.dataset.density = prefs.density;
  } catch(e) {}
})();
`;
