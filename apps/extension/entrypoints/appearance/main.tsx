import {
	type PopupAppearance,
	type PopupDensity,
	type PopupRadius,
	type PopupTheme,
	DEFAULT_APPEARANCE,
	applyAppearanceToRoot,
	loadAppearance,
	saveAppearance,
} from "../../lib/popup-appearance";
import { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import "./style.css";

function OptionsApp() {
	const [appearance, setAppearance] =
		useState<PopupAppearance>(DEFAULT_APPEARANCE);

	useEffect(() => {
		void loadAppearance().then((a) => {
			setAppearance(a);
			applyAppearanceToRoot(a);
		});
	}, []);

	const patch = async (partial: Partial<PopupAppearance>) => {
		const next = await saveAppearance(partial);
		setAppearance(next);
	};

	return (
		<div className="options-page">
			<h1 className="options-title">Extension appearance</h1>
			<p className="options-desc">
				These settings apply to the Kura toolbar popup. They are saved to your Chrome
				profile.
			</p>

			<section className="options-group" aria-labelledby="lbl-theme">
				<div id="lbl-theme" className="options-label">
					Theme
				</div>
				<div className="seg-row" role="group" aria-label="Theme">
					{(
						[
							["system", "System"],
							["light", "Light"],
							["dark", "Dark"],
						] as const
					).map(([value, label]) => (
						<button
							key={value}
							type="button"
							className="seg-btn"
							aria-pressed={appearance.theme === value}
							onClick={() => void patch({ theme: value as PopupTheme })}
						>
							{label}
						</button>
					))}
				</div>
			</section>

			<section className="options-group" aria-labelledby="lbl-radius">
				<div id="lbl-radius" className="options-label">
					Controls
				</div>
				<p className="options-desc options-desc-tight">
					Roundness for buttons, chips, and panels inside the popup. The browser toolbar
					window stays square — that is a Chrome limitation.
				</p>
				<div className="seg-row" role="group" aria-label="Control corner roundness">
					{(
						[
							["minimal", "Minimal"],
							["soft", "Soft"],
							["rounded", "Rounded"],
						] as const
					).map(([value, label]) => (
						<button
							key={value}
							type="button"
							className="seg-btn"
							aria-pressed={appearance.radius === value}
							onClick={() => void patch({ radius: value as PopupRadius })}
						>
							{label}
						</button>
					))}
				</div>
			</section>

			<section className="options-group" aria-labelledby="lbl-density">
				<div id="lbl-density" className="options-label">
					Spacing
				</div>
				<div className="seg-row" role="group" aria-label="Layout density">
					{(
						[
							["compact", "Compact"],
							["comfortable", "Comfortable"],
						] as const
					).map(([value, label]) => (
						<button
							key={value}
							type="button"
							className="seg-btn"
							aria-pressed={appearance.density === value}
							onClick={() => void patch({ density: value as PopupDensity })}
						>
							{label}
						</button>
					))}
				</div>
			</section>

			<section className="options-group" aria-labelledby="lbl-sections">
				<div id="lbl-sections" className="options-label">
					Popup contents
				</div>
				<p className="options-desc options-desc-tight">
					Choose which blocks appear in the toolbar popup. Saving still works when sections
					are hidden.
				</p>
				<div className="toggle-list">
					<div className="toggle-row">
						<div className="toggle-text">
							<div className="toggle-title">Current page</div>
							<div className="toggle-hint">Tab title and domain</div>
						</div>
						<div
							className="seg-row seg-row-tight"
							role="group"
							aria-label="Show current page"
						>
							<button
								type="button"
								className="seg-btn seg-btn-compact"
								aria-pressed={appearance.showCurrentPage}
								onClick={() => void patch({ showCurrentPage: true })}
							>
								On
							</button>
							<button
								type="button"
								className="seg-btn seg-btn-compact"
								aria-pressed={!appearance.showCurrentPage}
								onClick={() => void patch({ showCurrentPage: false })}
							>
								Off
							</button>
						</div>
					</div>
					<div className="toggle-row">
						<div className="toggle-text">
							<div className="toggle-title">Collections</div>
							<div className="toggle-hint">Inbox and collection chips</div>
						</div>
						<div
							className="seg-row seg-row-tight"
							role="group"
							aria-label="Show collection picker"
						>
							<button
								type="button"
								className="seg-btn seg-btn-compact"
								aria-pressed={appearance.showCollectionPicker}
								onClick={() => void patch({ showCollectionPicker: true })}
							>
								On
							</button>
							<button
								type="button"
								className="seg-btn seg-btn-compact"
								aria-pressed={!appearance.showCollectionPicker}
								onClick={() => void patch({ showCollectionPicker: false })}
							>
								Off
							</button>
						</div>
					</div>
					<div className="toggle-row">
						<div className="toggle-text">
							<div className="toggle-title">Recent</div>
							<div className="toggle-hint">Last saved links</div>
						</div>
						<div
							className="seg-row seg-row-tight"
							role="group"
							aria-label="Show recent bookmarks"
						>
							<button
								type="button"
								className="seg-btn seg-btn-compact"
								aria-pressed={appearance.showRecent}
								onClick={() => void patch({ showRecent: true })}
							>
								On
							</button>
							<button
								type="button"
								className="seg-btn seg-btn-compact"
								aria-pressed={!appearance.showRecent}
								onClick={() => void patch({ showRecent: false })}
							>
								Off
							</button>
						</div>
					</div>
				</div>
			</section>

			<div className="options-preview" aria-hidden>
				<div className="options-preview-label">Preview</div>
				<div className="preview-card">
					<div className="preview-row">
						<span className="preview-pill on">Active</span>
						<span className="preview-pill">Idle</span>
					</div>
					<div className="preview-row">
						<div className="preview-bar" />
					</div>
				</div>
			</div>
		</div>
	);
}

ReactDOM.createRoot(document.getElementById("root")!).render(<OptionsApp />);
