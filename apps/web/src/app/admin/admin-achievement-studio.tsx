"use client";

import { Button } from "@Kura/ui/components/button";
import { Input } from "@Kura/ui/components/input";
import { useToast } from "@Kura/ui/components/toast";
import { cn } from "@Kura/ui/lib/utils";
import { useMemo, useState } from "react";
import {
	AchievementBadgeCard,
	AchievementIcon,
	getAchievementCategoryHue,
} from "@/components/achievement-badge";

export interface AdminAchievementRecord {
	id: string;
	name: string;
	description: string;
	icon: string;
	xp: number;
	tier: number | null;
	sortOrder: number;
	isDiscoverable: boolean;
	isActive: boolean;
	isArchived: boolean;
	celebration: "subtle" | "rare" | "epic";
	rule: {
		type: "metric_threshold";
		metric:
			| "bookmarks_total"
			| "bookmarks_read"
			| "bookmarks_favorited"
			| "public_collections"
			| "followers_total"
			| "followed_collections"
			| "account_age"
			| "daily_streak"
			| "xp_level";
		threshold: number;
	};
	createdAt: string;
	updatedAt: string;
}

export interface AdminAchievementListResponse {
	achievements: AdminAchievementRecord[];
}

interface PreviewResponse {
	preview: {
		current: number;
		target: number;
		progress: number;
		isUnlocked: boolean;
	};
}

interface AdminAchievementStudioProps {
	initialAchievements: AdminAchievementRecord[];
	selectedUserId: string | null;
}

interface AchievementDraft {
	id: string;
	name: string;
	description: string;
	icon: string;
	xp: string;
	tier: string;
	sortOrder: string;
	isDiscoverable: boolean;
	isActive: boolean;
	isArchived: boolean;
	celebration: "subtle" | "rare" | "epic";
	metric: AdminAchievementRecord["rule"]["metric"];
	threshold: string;
}

function createBlankDraft(): AchievementDraft {
	return {
		id: "",
		name: "",
		description: "",
		icon: "",
		xp: "10",
		tier: "",
		sortOrder: "0",
		isDiscoverable: true,
		isActive: true,
		isArchived: false,
		celebration: "subtle",
		metric: "bookmarks_total",
		threshold: "1",
	};
}

function draftFromAchievement(
	achievement: AdminAchievementRecord,
): AchievementDraft {
	return {
		id: achievement.id,
		name: achievement.name,
		description: achievement.description,
		icon: achievement.icon,
		xp: String(achievement.xp),
		tier: achievement.tier === null ? "" : String(achievement.tier),
		sortOrder: String(achievement.sortOrder),
		isDiscoverable: achievement.isDiscoverable,
		isActive: achievement.isActive,
		isArchived: achievement.isArchived,
		celebration: achievement.celebration,
		metric: achievement.rule.metric,
		threshold: String(achievement.rule.threshold),
	};
}

// Visual indicators for celebration levels
const CELEBRATION_LEVELS = [
	{ value: "subtle" as const, label: "Subtle", hue: 210 },
	{ value: "rare" as const, label: "Rare", hue: 270 },
	{ value: "epic" as const, label: "Epic", hue: 45 },
];

// Available metrics with human-readable labels
const METRIC_OPTIONS: {
	value: AdminAchievementRecord["rule"]["metric"];
	label: string;
}[] = [
	{ value: "bookmarks_total", label: "Bookmarks" },
	{ value: "bookmarks_read", label: "Read" },
	{ value: "bookmarks_favorited", label: "Favorites" },
	{ value: "public_collections", label: "Collections" },
	{ value: "followers_total", label: "Followers" },
	{ value: "followed_collections", label: "Followed" },
	{ value: "account_age", label: "Age" },
	{ value: "daily_streak", label: "Streak" },
	{ value: "xp_level", label: "XP Level" },
];

async function parseErrorMessage(response: Response) {
	const payload = (await response.json().catch(() => null)) as {
		message?: string;
	} | null;
	return payload?.message ?? "Request failed";
}

export function AdminAchievementStudio({
	initialAchievements,
	selectedUserId,
}: AdminAchievementStudioProps) {
	const { toast } = useToast();
	const [achievements, setAchievements] = useState(initialAchievements);
	const [selectedAchievementId, setSelectedAchievementId] = useState<
		string | null
	>(initialAchievements[0]?.id ?? null);
	const [draft, setDraft] = useState<AchievementDraft>(() =>
		initialAchievements[0]
			? draftFromAchievement(initialAchievements[0])
			: createBlankDraft(),
	);
	const [preview, setPreview] = useState<PreviewResponse["preview"] | null>(
		null,
	);
	const [isSaving, setIsSaving] = useState(false);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [isReconciling, setIsReconciling] = useState(false);
	const [isGranting, setIsGranting] = useState(false);
	const [isRevoking, setIsRevoking] = useState(false);

	const selectedAchievement = useMemo(
		() =>
			selectedAchievementId
				? (achievements.find(
						(achievement) => achievement.id === selectedAchievementId,
					) ?? null)
				: null,
		[achievements, selectedAchievementId],
	);

	async function refreshAchievements() {
		setIsRefreshing(true);

		try {
			const response = await fetch(
				`${process.env.NEXT_PUBLIC_SERVER_URL}/admin/achievements`,
				{
					credentials: "include",
					cache: "no-store",
				},
			);

			if (!response.ok) {
				throw new Error(await parseErrorMessage(response));
			}

			const payload = (await response.json()) as AdminAchievementListResponse;
			setAchievements(payload.achievements);

			if (
				!payload.achievements.some((item) => item.id === selectedAchievementId)
			) {
				const nextAchievement = payload.achievements[0] ?? null;
				setSelectedAchievementId(nextAchievement?.id ?? null);
				setDraft(
					nextAchievement
						? draftFromAchievement(nextAchievement)
						: createBlankDraft(),
				);
			}
		} catch (error) {
			toast(
				error instanceof Error ? error.message : "Failed to load achievements",
				"error",
			);
		} finally {
			setIsRefreshing(false);
		}
	}

	function selectAchievement(achievement: AdminAchievementRecord) {
		setSelectedAchievementId(achievement.id);
		setDraft(draftFromAchievement(achievement));
		setPreview(null);
	}

	async function handleSave() {
		setIsSaving(true);

		try {
			const payload = {
				id: draft.id,
				name: draft.name,
				description: draft.description,
				icon: draft.icon,
				xp: Number(draft.xp),
				tier: draft.tier ? Number(draft.tier) : null,
				sortOrder: Number(draft.sortOrder),
				isDiscoverable: draft.isDiscoverable,
				isActive: draft.isActive,
				isArchived: draft.isArchived,
				celebration: draft.celebration,
				rule: {
					type: "metric_threshold" as const,
					metric: draft.metric,
					threshold: Number(draft.threshold),
				},
			};

			const response = await fetch(
				selectedAchievement
					? `${process.env.NEXT_PUBLIC_SERVER_URL}/admin/achievements/${selectedAchievement.id}`
					: `${process.env.NEXT_PUBLIC_SERVER_URL}/admin/achievements`,
				{
					method: selectedAchievement ? "PATCH" : "POST",
					headers: {
						"Content-Type": "application/json",
					},
					credentials: "include",
					body: JSON.stringify(payload),
				},
			);

			if (!response.ok) {
				throw new Error(await parseErrorMessage(response));
			}

			toast(
				selectedAchievement
					? "Achievement updated successfully"
					: "Achievement created successfully",
				"success",
			);

			await refreshAchievements();
			if (!selectedAchievement) {
				setSelectedAchievementId(draft.id);
			}
		} catch (error) {
			toast(
				error instanceof Error ? error.message : "Failed to save achievement",
				"error",
			);
		} finally {
			setIsSaving(false);
		}
	}

	async function handlePreview() {
		if (!selectedAchievementId || !selectedUserId) {
			toast("Select a user and save the achievement first", "error");
			return;
		}

		try {
			const response = await fetch(
				`${process.env.NEXT_PUBLIC_SERVER_URL}/admin/achievements/${selectedAchievementId}/preview`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					credentials: "include",
					body: JSON.stringify({
						userId: selectedUserId,
					}),
				},
			);

			if (!response.ok) {
				throw new Error(await parseErrorMessage(response));
			}

			const payload = (await response.json()) as PreviewResponse;
			setPreview(payload.preview);
		} catch (error) {
			toast(
				error instanceof Error
					? error.message
					: "Failed to preview achievement",
				"error",
			);
		}
	}

	async function handleSyncDefaults() {
		setIsRefreshing(true);

		try {
			const response = await fetch(
				`${process.env.NEXT_PUBLIC_SERVER_URL}/admin/achievements/sync-defaults`,
				{
					method: "POST",
					credentials: "include",
				},
			);

			if (!response.ok) {
				throw new Error(await parseErrorMessage(response));
			}

			toast("Default achievements synced", "success");
			await refreshAchievements();
		} catch (error) {
			toast(
				error instanceof Error ? error.message : "Failed to sync achievements",
				"error",
			);
		} finally {
			setIsRefreshing(false);
		}
	}

	async function handleReconcile(scope: "selected" | "all") {
		setIsReconciling(true);

		try {
			const response = await fetch(
				`${process.env.NEXT_PUBLIC_SERVER_URL}/admin/achievements/reconcile`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					credentials: "include",
					body: JSON.stringify({
						userId:
							scope === "selected" ? (selectedUserId ?? undefined) : undefined,
					}),
				},
			);

			if (!response.ok) {
				throw new Error(await parseErrorMessage(response));
			}

			toast(
				scope === "selected"
					? "Selected user reconciliation queued"
					: "Global reconciliation queued",
				"success",
			);
		} catch (error) {
			toast(
				error instanceof Error ? error.message : "Failed to queue reconcile",
				"error",
			);
		} finally {
			setIsReconciling(false);
		}
	}

	async function handleGrantToSelectedUser() {
		if (!selectedUserId || !selectedAchievementId) {
			toast("Select both a user and an achievement", "error");
			return;
		}

		setIsGranting(true);

		try {
			const response = await fetch(
				`${process.env.NEXT_PUBLIC_SERVER_URL}/admin/users/${selectedUserId}/achievements/${selectedAchievementId}/grant`,
				{
					method: "POST",
					credentials: "include",
				},
			);

			if (!response.ok) {
				throw new Error(await parseErrorMessage(response));
			}

			toast("Achievement granted to user", "success");
			await handlePreview();
		} catch (error) {
			toast(
				error instanceof Error ? error.message : "Failed to grant achievement",
				"error",
			);
		} finally {
			setIsGranting(false);
		}
	}

	async function handleRevokeFromSelectedUser() {
		if (!selectedUserId || !selectedAchievementId) {
			toast("Select both a user and an achievement", "error");
			return;
		}

		setIsRevoking(true);

		try {
			const response = await fetch(
				`${process.env.NEXT_PUBLIC_SERVER_URL}/admin/users/${selectedUserId}/achievements/${selectedAchievementId}/revoke`,
				{
					method: "POST",
					credentials: "include",
				},
			);

			if (!response.ok) {
				throw new Error(await parseErrorMessage(response));
			}

			toast("Achievement revoked from user", "success");
			await handlePreview();
		} catch (error) {
			toast(
				error instanceof Error ? error.message : "Failed to revoke achievement",
				"error",
			);
		} finally {
			setIsRevoking(false);
		}
	}

	return (
		<section className="rounded-3xl border border-border bg-card/80 p-5">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 className="font-medium text-foreground text-lg">
						Achievement studio
					</h2>
					<p className="mt-1 text-muted-foreground text-sm">
						Manage the DB-backed achievement catalog, preview progress, and
						queue reconciliations.
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						variant="outline"
						onClick={() => void handleSyncDefaults()}
						disabled={isRefreshing}
					>
						Sync defaults
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={() => void handleReconcile("selected")}
						disabled={isReconciling || !selectedUserId}
					>
						Reconcile selected user
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={() => void handleReconcile("all")}
						disabled={isReconciling}
					>
						Reconcile all users
					</Button>
				</div>
			</div>

			<div className="mt-5 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
				<div className="space-y-2">
					<Button
						type="button"
						variant="outline"
						className="w-full"
						onClick={() => {
							setSelectedAchievementId(null);
							setDraft(createBlankDraft());
							setPreview(null);
						}}
					>
						New achievement
					</Button>
					{achievements.map((achievement) => {
						const isSelected = achievement.id === selectedAchievementId;
						const celebrationMeta = CELEBRATION_LEVELS.find(
							(c) => c.value === achievement.celebration,
						);

						return (
							<button
								type="button"
								key={achievement.id}
								onClick={() => selectAchievement(achievement)}
								className={cn(
									"flex w-full cursor-pointer items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors",
									isSelected
										? "border-foreground/20 bg-foreground/5"
										: "border-border bg-background/30 hover:bg-background/50",
								)}
							>
								{/* Category icon */}
								<span
									className="flex size-8 shrink-0 items-center justify-center rounded-lg"
									style={{
										background: `oklch(0.22 0.05 ${getAchievementCategoryHue(achievement.icon)})`,
										color: `oklch(0.70 0.12 ${getAchievementCategoryHue(achievement.icon)})`,
									}}
								>
									<AchievementIcon icon={achievement.icon} className="size-4" />
								</span>

								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<p className="truncate font-medium text-foreground text-sm">
											{achievement.name}
										</p>
										{/* Celebration level dot */}
										{celebrationMeta && (
											<span
												className="size-2 shrink-0 rounded-full"
												style={{
													background: `oklch(0.65 0.16 ${celebrationMeta.hue})`,
												}}
												title={celebrationMeta.label}
											/>
										)}
									</div>
									<p className="truncate text-muted-foreground text-xs">
										{achievement.rule.metric} &ge; {achievement.rule.threshold}
									</p>
								</div>
							</button>
						);
					})}
				</div>

				<div className="space-y-5">
					<div className="grid gap-4 md:grid-cols-2">
						<div>
							<label className="text-muted-foreground text-xs" htmlFor="ach-id">
								ID
							</label>
							<Input
								id="ach-id"
								value={draft.id}
								onChange={(event) => {
									const { value } = event.currentTarget;
									setDraft((currentValue) => ({
										...currentValue,
										id: value,
									}));
								}}
								disabled={Boolean(selectedAchievement)}
							/>
						</div>
						<div>
							<label
								className="text-muted-foreground text-xs"
								htmlFor="ach-name"
							>
								Name
							</label>
							<Input
								id="ach-name"
								value={draft.name}
								onChange={(event) => {
									const { value } = event.currentTarget;
									setDraft((currentValue) => ({
										...currentValue,
										name: value,
									}));
								}}
							/>
						</div>
						<div className="md:col-span-2">
							<label
								className="text-muted-foreground text-xs"
								htmlFor="ach-description"
							>
								Description
							</label>
							<Input
								id="ach-description"
								value={draft.description}
								onChange={(event) => {
									const { value } = event.currentTarget;
									setDraft((currentValue) => ({
										...currentValue,
										description: value,
									}));
								}}
							/>
						</div>
						<div>
							<label
								className="text-muted-foreground text-xs"
								htmlFor="ach-icon"
							>
								Icon
							</label>
							<Input
								id="ach-icon"
								value={draft.icon}
								onChange={(event) => {
									const { value } = event.currentTarget;
									setDraft((currentValue) => ({
										...currentValue,
										icon: value,
									}));
								}}
							/>
						</div>
						<div>
							<label className="text-muted-foreground text-xs" htmlFor="ach-xp">
								XP
							</label>
							<Input
								id="ach-xp"
								type="number"
								value={draft.xp}
								onChange={(event) => {
									const { value } = event.currentTarget;
									setDraft((currentValue) => ({
										...currentValue,
										xp: value,
									}));
								}}
							/>
						</div>
						<div>
							<label
								className="text-muted-foreground text-xs"
								htmlFor="ach-tier"
							>
								Tier
							</label>
							<Input
								id="ach-tier"
								type="number"
								value={draft.tier}
								onChange={(event) => {
									const { value } = event.currentTarget;
									setDraft((currentValue) => ({
										...currentValue,
										tier: value,
									}));
								}}
							/>
						</div>
						<div>
							<label
								className="text-muted-foreground text-xs"
								htmlFor="ach-sort-order"
							>
								Sort order
							</label>
							<Input
								id="ach-sort-order"
								type="number"
								value={draft.sortOrder}
								onChange={(event) => {
									const { value } = event.currentTarget;
									setDraft((currentValue) => ({
										...currentValue,
										sortOrder: value,
									}));
								}}
							/>
						</div>
						{/* Celebration — styled pill selector */}
						<div>
							<p className="text-muted-foreground text-xs">Celebration</p>
							<div className="mt-2 flex gap-1.5">
								{CELEBRATION_LEVELS.map((level) => (
									<button
										key={level.value}
										type="button"
										onClick={() =>
											setDraft((currentValue) => ({
												...currentValue,
												celebration: level.value,
											}))
										}
										className={cn(
											"flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 font-medium text-xs transition-colors",
											draft.celebration === level.value
												? "border-foreground/20 bg-foreground/5 text-foreground"
												: "border-border bg-background/30 text-muted-foreground hover:bg-background/50",
										)}
									>
										<span
											className="size-2 rounded-full"
											style={{
												background: `oklch(0.65 0.16 ${level.hue})`,
											}}
										/>
										{level.label}
									</button>
								))}
							</div>
						</div>

						{/* Metric — styled pill selector */}
						<div className="md:col-span-2">
							<p className="text-muted-foreground text-xs">Metric</p>
							<div className="mt-2 flex flex-wrap gap-1.5">
								{METRIC_OPTIONS.map((option) => (
									<button
										key={option.value}
										type="button"
										onClick={() =>
											setDraft((currentValue) => ({
												...currentValue,
												metric: option.value,
											}))
										}
										className={cn(
											"cursor-pointer rounded-lg border px-2.5 py-1.5 font-medium text-xs transition-colors",
											draft.metric === option.value
												? "border-foreground/20 bg-foreground/5 text-foreground"
												: "border-border bg-background/30 text-muted-foreground hover:bg-background/50",
										)}
									>
										{option.label}
									</button>
								))}
							</div>
						</div>
						<div>
							<label
								className="text-muted-foreground text-xs"
								htmlFor="ach-threshold"
							>
								Threshold
							</label>
							<Input
								id="ach-threshold"
								type="number"
								value={draft.threshold}
								onChange={(event) => {
									const { value } = event.currentTarget;
									setDraft((currentValue) => ({
										...currentValue,
										threshold: value,
									}));
								}}
							/>
						</div>
					</div>

					<div className="flex flex-wrap gap-4 text-muted-foreground text-sm">
						<label className="flex cursor-pointer items-center gap-2">
							<input
								type="checkbox"
								checked={draft.isDiscoverable}
								onChange={(event) => {
									const { checked } = event.currentTarget;
									setDraft((currentValue) => ({
										...currentValue,
										isDiscoverable: checked,
									}));
								}}
							/>
							Discoverable
						</label>
						<label className="flex cursor-pointer items-center gap-2">
							<input
								type="checkbox"
								checked={draft.isActive}
								onChange={(event) => {
									const { checked } = event.currentTarget;
									setDraft((currentValue) => ({
										...currentValue,
										isActive: checked,
									}));
								}}
							/>
							Active
						</label>
						<label className="flex cursor-pointer items-center gap-2">
							<input
								type="checkbox"
								checked={draft.isArchived}
								onChange={(event) => {
									const { checked } = event.currentTarget;
									setDraft((currentValue) => ({
										...currentValue,
										isArchived: checked,
									}));
								}}
							/>
							Archived
						</label>
					</div>

					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							onClick={() => void handleSave()}
							disabled={isSaving}
						>
							{isSaving
								? "Saving..."
								: selectedAchievement
									? "Save changes"
									: "Create achievement"}
						</Button>
						<Button
							type="button"
							variant="outline"
							onClick={() => void handlePreview()}
							disabled={!selectedAchievementId || !selectedUserId}
						>
							Preview for selected user
						</Button>
						<Button
							type="button"
							variant="outline"
							onClick={() => void handleGrantToSelectedUser()}
							disabled={!selectedAchievementId || !selectedUserId || isGranting}
						>
							{isGranting ? "Granting..." : "Grant to selected user"}
						</Button>
						<Button
							type="button"
							variant="outline"
							onClick={() => void handleRevokeFromSelectedUser()}
							disabled={!selectedAchievementId || !selectedUserId || isRevoking}
						>
							{isRevoking ? "Revoking..." : "Revoke from selected user"}
						</Button>
					</div>

					{/* Live badge card preview showing how the badge will appear */}
					<div className="rounded-2xl border border-border bg-background/30 p-4">
						<h3 className="font-medium text-foreground text-sm">
							Live badge preview
						</h3>
						<div className="mt-3 max-w-xs">
							<AchievementBadgeCard
								badge={{
									id: draft.id || "preview",
									name: draft.name || "Badge Name",
									description: draft.description || "Badge description…",
									icon: draft.icon || "bookmark-plus",
									xp: Number(draft.xp) || 0,
									celebration: draft.celebration,
									tier: draft.tier ? Number(draft.tier) : undefined,
									isUnlocked: true,
									current: preview?.current,
									target: preview?.target,
									progress: preview?.progress,
								}}
							/>
						</div>
					</div>

					{/* User progress preview */}
					<div className="rounded-2xl border border-border bg-background/30 p-4">
						<h3 className="font-medium text-foreground text-sm">
							User progress
						</h3>
						{preview ? (
							<div className="mt-3 grid gap-3 sm:grid-cols-4">
								<div>
									<p className="text-muted-foreground text-xs">Current</p>
									<p className="mt-1 text-foreground text-sm [font-variant-numeric:tabular-nums]">
										{preview.current}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground text-xs">Target</p>
									<p className="mt-1 text-foreground text-sm [font-variant-numeric:tabular-nums]">
										{preview.target}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground text-xs">Progress</p>
									<p className="mt-1 text-foreground text-sm [font-variant-numeric:tabular-nums]">
										{Math.round(preview.progress * 100)}%
									</p>
								</div>
								<div>
									<p className="text-muted-foreground text-xs">Unlocked</p>
									<p className="mt-1 text-foreground text-sm">
										{preview.isUnlocked ? "Yes" : "No"}
									</p>
								</div>
							</div>
						) : (
							<p className="mt-3 text-muted-foreground text-sm">
								Select a saved achievement and a user from the moderation panel
								to preview current progress.
							</p>
						)}
					</div>
				</div>
			</div>
		</section>
	);
}
