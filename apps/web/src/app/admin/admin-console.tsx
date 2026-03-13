"use client";

import { Button } from "@Kura/ui/components/button";
import { Input } from "@Kura/ui/components/input";
import { useToast } from "@Kura/ui/components/toast";
import { useEffect, useMemo, useState } from "react";
import {
	type AdminAchievementListResponse,
	type AdminAchievementRecord,
	AdminAchievementStudio,
} from "./admin-achievement-studio";

export interface AdminOverviewResponse {
	viewer: {
		id: string;
		name: string;
		email: string;
		role: "user" | "admin";
		status: "active" | "banned";
	} | null;
	stats: {
		userCount: number;
		unlockedAchievementCount: number;
	};
}

export interface AdminUserListItem {
	id: string;
	name: string;
	email: string;
	username: string | null;
	image: string | null;
	role: "user" | "admin";
	status: "active" | "banned";
	bannedAt: string | null;
	createdAt: string;
}

export interface AdminUserListResponse {
	users: AdminUserListItem[];
}

interface AdminUserDetailResponse {
	user: {
		id: string;
		name: string;
		email: string;
		username: string | null;
		image: string | null;
		bio: string | null;
		role: "user" | "admin";
		status: "active" | "banned";
		bannedAt: string | null;
		banReason: string | null;
		bannedByUserId: string | null;
		createdAt: string;
		updatedAt: string;
	};
	social: {
		followerCount: number;
		followingCount: number;
	};
	badges: {
		stats: {
			totalBookmarks: number;
			totalReadBookmarks: number;
			totalFavoriteBookmarks: number;
			totalPublicCollections: number;
			totalFollowers: number;
			totalFollowedCollections: number;
			currentDailyStreak: number;
			longestDailyStreak: number;
			totalXp: number;
			level: number;
		};
		unlocked: Array<{
			id: string;
			name: string;
			xp: number;
			unlockedAt: string | null;
		}>;
	};
	moderationLog: Array<{
		id: string;
		action: "ban_user" | "unban_user";
		reason: string | null;
		createdAt: string;
		admin: {
			id: string;
			name: string;
			email: string;
		} | null;
	}>;
}

interface AdminConsoleProps {
	initialOverview: AdminOverviewResponse;
	initialUsers: AdminUserListItem[];
	initialAchievements: AdminAchievementRecord[];
}

function formatDate(value: string | null) {
	if (!value) return "Never";
	return new Date(value).toLocaleString();
}

function getStatusChipClasses(status: "active" | "banned") {
	return status === "banned"
		? "border-destructive/30 bg-destructive/10 text-destructive"
		: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
}

async function parseErrorMessage(response: Response) {
	const payload = (await response.json().catch(() => null)) as {
		message?: string;
	} | null;
	return payload?.message ?? "Request failed";
}

export function AdminConsole({
	initialOverview,
	initialUsers,
	initialAchievements,
}: AdminConsoleProps) {
	const { toast } = useToast();
	const [searchQuery, setSearchQuery] = useState("");
	const [users, setUsers] = useState(initialUsers);
	const [selectedUserId, setSelectedUserId] = useState<string | null>(
		initialUsers[0]?.id ?? null,
	);
	const [selectedUserDetail, setSelectedUserDetail] =
		useState<AdminUserDetailResponse | null>(null);
	const [detailReloadToken, setDetailReloadToken] = useState(0);
	const [isLoadingUsers, setIsLoadingUsers] = useState(false);
	const [isLoadingDetail, setIsLoadingDetail] = useState(false);
	const [moderationReason, setModerationReason] = useState("");
	const [isSubmittingModeration, setIsSubmittingModeration] = useState(false);

	const selectedUserListItem = useMemo(
		() => users.find((user) => user.id === selectedUserId) ?? null,
		[users, selectedUserId],
	);

	useEffect(() => {
		if (!selectedUserId) {
			setSelectedUserDetail(null);
			return;
		}

		let isCancelled = false;

		async function loadUserDetail() {
			setIsLoadingDetail(true);

			try {
				const detailUrl = new URL(
					`${process.env.NEXT_PUBLIC_SERVER_URL}/admin/users/${selectedUserId}`,
				);
				detailUrl.searchParams.set("refresh", String(detailReloadToken));

				const response = await fetch(detailUrl, {
					credentials: "include",
					cache: "no-store",
				});

				if (!response.ok) {
					throw new Error(await parseErrorMessage(response));
				}

				const payload = (await response.json()) as AdminUserDetailResponse;
				if (!isCancelled) {
					setSelectedUserDetail(payload);
				}
			} catch (error) {
				if (!isCancelled) {
					setSelectedUserDetail(null);
				}
				toast(
					error instanceof Error
						? error.message
						: "Failed to load user details",
					"error",
				);
			} finally {
				if (!isCancelled) {
					setIsLoadingDetail(false);
				}
			}
		}

		void loadUserDetail();

		return () => {
			isCancelled = true;
		};
	}, [detailReloadToken, selectedUserId, toast]);

	async function refreshUserList(nextQuery = searchQuery) {
		setIsLoadingUsers(true);

		try {
			const url = new URL(`${process.env.NEXT_PUBLIC_SERVER_URL}/admin/users`);
			if (nextQuery.trim()) {
				url.searchParams.set("q", nextQuery.trim());
			}

			const response = await fetch(url, {
				credentials: "include",
				cache: "no-store",
			});

			if (!response.ok) {
				throw new Error(await parseErrorMessage(response));
			}

			const payload = (await response.json()) as AdminUserListResponse;
			setUsers(payload.users);

			if (!payload.users.some((user) => user.id === selectedUserId)) {
				setSelectedUserId(payload.users[0]?.id ?? null);
			}
		} catch (error) {
			toast(
				error instanceof Error ? error.message : "Failed to load users",
				"error",
			);
		} finally {
			setIsLoadingUsers(false);
		}
	}

	async function handleModeration(action: "ban" | "unban") {
		if (!selectedUserDetail) {
			return;
		}

		setIsSubmittingModeration(true);

		try {
			const response = await fetch(
				`${process.env.NEXT_PUBLIC_SERVER_URL}/admin/users/${selectedUserDetail.user.id}/${action}`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					credentials: "include",
					body: JSON.stringify({ reason: moderationReason }),
				},
			);

			if (!response.ok) {
				throw new Error(await parseErrorMessage(response));
			}

			setModerationReason("");
			toast(
				action === "ban"
					? "User banned successfully"
					: "User unbanned successfully",
				"success",
			);
			await refreshUserList();
			setDetailReloadToken((currentValue) => currentValue + 1);
		} catch (error) {
			toast(
				error instanceof Error ? error.message : "Failed to update moderation",
				"error",
			);
		} finally {
			setIsSubmittingModeration(false);
		}
	}

	return (
		<main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-12">
			<div className="space-y-2">
				<p className="font-medium text-muted-foreground text-sm uppercase tracking-[0.24em]">
					Admin
				</p>
				<h1 className="font-semibold text-4xl text-foreground tracking-tight">
					Control center
				</h1>
				<p className="max-w-2xl text-muted-foreground text-sm leading-6">
					Search accounts, inspect badge progress, and take moderation actions
					from a single protected workspace.
				</p>
			</div>

			<div className="grid gap-4 md:grid-cols-3">
				<div className="rounded-3xl border border-border bg-card/80 p-5">
					<p className="text-muted-foreground text-xs">Signed in as</p>
					<p className="mt-2 font-medium text-foreground text-lg">
						{initialOverview.viewer?.name}
					</p>
					<p className="text-muted-foreground text-sm">
						{initialOverview.viewer?.email}
					</p>
				</div>
				<div className="rounded-3xl border border-border bg-card/80 p-5">
					<p className="text-muted-foreground text-xs">Users</p>
					<p className="mt-2 font-semibold text-3xl text-foreground">
						{initialOverview.stats.userCount}
					</p>
				</div>
				<div className="rounded-3xl border border-border bg-card/80 p-5">
					<p className="text-muted-foreground text-xs">Unlocked achievements</p>
					<p className="mt-2 font-semibold text-3xl text-foreground">
						{initialOverview.stats.unlockedAchievementCount}
					</p>
				</div>
			</div>

			<div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
				<section className="rounded-3xl border border-border bg-card/80 p-5">
					<div className="flex items-center justify-between gap-3">
						<h2 className="font-medium text-foreground text-lg">Users</h2>
						{isLoadingUsers ? (
							<span className="text-muted-foreground text-xs">
								Refreshing...
							</span>
						) : null}
					</div>

					<form
						className="mt-4 flex gap-2"
						onSubmit={(event) => {
							event.preventDefault();
							void refreshUserList();
						}}
					>
						<label className="sr-only" htmlFor="admin-user-search">
							Search users
						</label>
						<Input
							id="admin-user-search"
							value={searchQuery}
							onChange={(event) => setSearchQuery(event.currentTarget.value)}
							placeholder="Search name, email, or username"
							autoComplete="off"
							spellCheck={false}
						/>
						<Button type="submit" variant="outline">
							Search
						</Button>
					</form>

					<div className="mt-4 space-y-2">
						{users.length === 0 ? (
							<div className="rounded-2xl border border-border border-dashed px-4 py-6 text-center text-muted-foreground text-sm">
								No users match this search.
							</div>
						) : (
							users.map((user) => {
								const isSelected = user.id === selectedUserId;

								return (
									<button
										type="button"
										key={user.id}
										onClick={() => setSelectedUserId(user.id)}
										className={`flex w-full cursor-pointer flex-col gap-2 rounded-2xl border px-4 py-3 text-left transition-colors ${
											isSelected
												? "border-foreground/20 bg-foreground/5"
												: "border-border bg-background/30 hover:bg-background/50"
										}`}
									>
										<div className="flex items-center justify-between gap-3">
											<p className="font-medium text-foreground text-sm">
												{user.name}
											</p>
											<span
												className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-[0.16em] ${getStatusChipClasses(user.status)}`}
											>
												{user.status}
											</span>
										</div>
										<p className="truncate text-muted-foreground text-xs">
											{user.email}
										</p>
										<p className="text-muted-foreground text-xs">
											{user.username ? `@${user.username}` : "No username"}
										</p>
									</button>
								);
							})
						)}
					</div>
				</section>

				<section className="rounded-3xl border border-border bg-card/80 p-5">
					{!selectedUserId ? (
						<div className="rounded-2xl border border-border border-dashed px-4 py-12 text-center text-muted-foreground text-sm">
							Select a user to inspect their account and moderation history.
						</div>
					) : isLoadingDetail || !selectedUserDetail ? (
						<div className="rounded-2xl border border-border border-dashed px-4 py-12 text-center text-muted-foreground text-sm">
							Loading user details...
						</div>
					) : (
						<div className="space-y-6">
							<div className="flex flex-wrap items-start justify-between gap-4">
								<div className="space-y-2">
									<div className="flex items-center gap-3">
										<h2 className="font-medium text-2xl text-foreground">
											{selectedUserDetail.user.name}
										</h2>
										<span
											className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] ${getStatusChipClasses(selectedUserDetail.user.status)}`}
										>
											{selectedUserDetail.user.status}
										</span>
									</div>
									<p className="text-muted-foreground text-sm">
										{selectedUserDetail.user.email}
									</p>
									<p className="text-muted-foreground text-sm">
										{selectedUserDetail.user.username
											? `@${selectedUserDetail.user.username}`
											: "No username"}
									</p>
								</div>
								<div className="rounded-2xl border border-border bg-background/40 px-4 py-3 text-right">
									<p className="text-muted-foreground text-xs">Joined</p>
									<p className="mt-1 text-foreground text-sm">
										{formatDate(selectedUserDetail.user.createdAt)}
									</p>
								</div>
							</div>

							{selectedUserDetail.user.bio ? (
								<p className="rounded-2xl border border-border bg-background/30 px-4 py-3 text-muted-foreground text-sm leading-6">
									{selectedUserDetail.user.bio}
								</p>
							) : null}

							<div className="grid gap-4 md:grid-cols-4">
								<div className="rounded-2xl border border-border bg-background/30 p-4">
									<p className="text-muted-foreground text-xs">Followers</p>
									<p className="mt-2 font-semibold text-2xl text-foreground">
										{selectedUserDetail.social.followerCount}
									</p>
								</div>
								<div className="rounded-2xl border border-border bg-background/30 p-4">
									<p className="text-muted-foreground text-xs">Following</p>
									<p className="mt-2 font-semibold text-2xl text-foreground">
										{selectedUserDetail.social.followingCount}
									</p>
								</div>
								<div className="rounded-2xl border border-border bg-background/30 p-4">
									<p className="text-muted-foreground text-xs">XP</p>
									<p className="mt-2 font-semibold text-2xl text-foreground">
										{selectedUserDetail.badges.stats.totalXp}
									</p>
								</div>
								<div className="rounded-2xl border border-border bg-background/30 p-4">
									<p className="text-muted-foreground text-xs">Level</p>
									<p className="mt-2 font-semibold text-2xl text-foreground">
										{selectedUserDetail.badges.stats.level}
									</p>
								</div>
							</div>

							<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
								<div className="space-y-6">
									<div className="rounded-2xl border border-border bg-background/30 p-4">
										<h3 className="font-medium text-base text-foreground">
											Badge progress
										</h3>
										<div className="mt-4 grid gap-3 sm:grid-cols-2">
											<div className="rounded-xl border border-border px-3 py-3">
												<p className="text-muted-foreground text-xs">
													Bookmarks
												</p>
												<p className="mt-1 text-foreground text-sm">
													{selectedUserDetail.badges.stats.totalBookmarks}
												</p>
											</div>
											<div className="rounded-xl border border-border px-3 py-3">
												<p className="text-muted-foreground text-xs">
													Read bookmarks
												</p>
												<p className="mt-1 text-foreground text-sm">
													{selectedUserDetail.badges.stats.totalReadBookmarks}
												</p>
											</div>
											<div className="rounded-xl border border-border px-3 py-3">
												<p className="text-muted-foreground text-xs">
													Favorites
												</p>
												<p className="mt-1 text-foreground text-sm">
													{
														selectedUserDetail.badges.stats
															.totalFavoriteBookmarks
													}
												</p>
											</div>
											<div className="rounded-xl border border-border px-3 py-3">
												<p className="text-muted-foreground text-xs">
													Current streak
												</p>
												<p className="mt-1 text-foreground text-sm">
													{selectedUserDetail.badges.stats.currentDailyStreak}
												</p>
											</div>
										</div>
										<div className="mt-4">
											<p className="text-muted-foreground text-xs">
												Recently unlocked
											</p>
											<div className="mt-2 flex flex-wrap gap-2">
												{selectedUserDetail.badges.unlocked.length === 0 ? (
													<span className="text-muted-foreground text-sm">
														No unlocked badges yet.
													</span>
												) : (
													selectedUserDetail.badges.unlocked
														.slice(0, 8)
														.map((badge) => (
															<span
																key={badge.id}
																className="rounded-full border border-border bg-background/40 px-3 py-1 text-foreground text-xs"
															>
																{badge.name}
															</span>
														))
												)}
											</div>
										</div>
									</div>

									<div className="rounded-2xl border border-border bg-background/30 p-4">
										<h3 className="font-medium text-base text-foreground">
											Moderation history
										</h3>
										<div className="mt-4 space-y-3">
											{selectedUserDetail.moderationLog.length === 0 ? (
												<p className="text-muted-foreground text-sm">
													No moderation actions recorded.
												</p>
											) : (
												selectedUserDetail.moderationLog.map((entry) => (
													<div
														key={entry.id}
														className="rounded-xl border border-border px-3 py-3"
													>
														<div className="flex items-center justify-between gap-3">
															<p className="font-medium text-foreground text-sm">
																{entry.action === "ban_user"
																	? "Banned"
																	: "Unbanned"}
															</p>
															<p className="text-muted-foreground text-xs">
																{formatDate(entry.createdAt)}
															</p>
														</div>
														<p className="mt-2 text-muted-foreground text-sm">
															{entry.reason ?? "No reason provided"}
														</p>
														<p className="mt-2 text-muted-foreground text-xs">
															By {entry.admin?.name ?? "Unknown admin"}
														</p>
													</div>
												))
											)}
										</div>
									</div>
								</div>

								<div className="rounded-2xl border border-border bg-background/30 p-4">
									<h3 className="font-medium text-base text-foreground">
										Moderation actions
									</h3>
									<p className="mt-2 text-muted-foreground text-sm leading-6">
										Record a reason for moderation changes so future admins can
										understand why this account was updated.
									</p>
									<label
										className="mt-4 block text-muted-foreground text-xs"
										htmlFor="moderation-reason"
									>
										Reason
									</label>
									<textarea
										id="moderation-reason"
										value={moderationReason}
										onChange={(event) =>
											setModerationReason(event.currentTarget.value)
										}
										className="mt-2 min-h-28 w-full resize-none rounded-2xl border border-input bg-background/40 px-3 py-3 text-foreground text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
										placeholder="Explain the moderation action"
										spellCheck={false}
									/>

									{selectedUserDetail.user.status === "banned" ? (
										<div className="mt-4 space-y-3">
											<div className="rounded-xl border border-border px-3 py-3 text-muted-foreground text-sm">
												Banned at {formatDate(selectedUserDetail.user.bannedAt)}
												{selectedUserDetail.user.banReason
													? ` for ${selectedUserDetail.user.banReason}`
													: ""}
											</div>
											<Button
												type="button"
												className="w-full"
												onClick={() => void handleModeration("unban")}
												disabled={isSubmittingModeration}
											>
												{isSubmittingModeration ? "Saving..." : "Unban user"}
											</Button>
										</div>
									) : (
										<Button
											type="button"
											variant="destructive"
											className="mt-4 w-full"
											onClick={() => void handleModeration("ban")}
											disabled={isSubmittingModeration}
										>
											{isSubmittingModeration ? "Saving..." : "Ban user"}
										</Button>
									)}
								</div>
							</div>
						</div>
					)}
				</section>
			</div>

			{selectedUserListItem ? (
				<p className="text-muted-foreground text-xs">
					Selected account: {selectedUserListItem.email}
				</p>
			) : null}

			<AdminAchievementStudio
				initialAchievements={initialAchievements}
				selectedUserId={selectedUserId}
			/>
		</main>
	);
}

export type { AdminAchievementListResponse };
