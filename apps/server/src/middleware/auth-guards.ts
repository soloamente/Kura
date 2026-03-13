import type { UserRole, UserStatus } from "@Kura/db/schema/auth";

interface GuardSet {
	status?: number | string;
}

export interface GuardUser {
	id: string;
	role: UserRole;
	status: UserStatus;
}

export interface GuardError {
	message: string;
}

// Shared authz guards keep route behavior consistent across routers and make it
// easier to introduce roles or moderation states without copy-pasting checks.
export function requireAuth(
	user: GuardUser | null,
	set: GuardSet,
): GuardError | null {
	if (user) {
		return null;
	}

	set.status = 401;
	return { message: "Unauthorized" };
}

export function requireActiveUser(
	user: GuardUser | null,
	set: GuardSet,
): GuardError | null {
	const authError = requireAuth(user, set);
	if (authError) {
		return authError;
	}

	if (!user) {
		set.status = 401;
		return { message: "Unauthorized" };
	}

	if (user.status === "active") {
		return null;
	}

	set.status = 403;
	return { message: "Account is banned" };
}

export function requireAdmin(
	user: GuardUser | null,
	set: GuardSet,
): GuardError | null {
	const activeError = requireActiveUser(user, set);
	if (activeError) {
		return activeError;
	}

	if (!user) {
		set.status = 401;
		return { message: "Unauthorized" };
	}

	if (user.role === "admin") {
		return null;
	}

	set.status = 403;
	return { message: "Admin access required" };
}

export function getActiveUser(
	user: GuardUser | null,
	set: GuardSet,
): GuardUser | GuardError {
	const activeError = requireActiveUser(user, set);
	if (activeError) {
		return activeError;
	}

	if (!user) {
		return { message: "Unauthorized" };
	}

	return user;
}

export function getAdminUser(
	user: GuardUser | null,
	set: GuardSet,
): GuardUser | GuardError {
	const adminError = requireAdmin(user, set);
	if (adminError) {
		return adminError;
	}

	if (!user) {
		return { message: "Unauthorized" };
	}

	return user;
}
