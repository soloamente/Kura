import type { AdminActionType, UserStatus } from "@Kura/db/schema/auth";

type ModerationAction = "ban" | "unban";

interface BuildModerationUpdateInput {
	action: ModerationAction;
	actorUserId: string;
	targetUserId: string;
	reason: string;
	now: Date;
}

interface ModerationPatch {
	status: UserStatus;
	bannedAt: Date | null;
	banReason: string | null;
	bannedByUserId: string | null;
}

interface ModerationUpdateResult {
	userPatch: ModerationPatch;
	auditAction: AdminActionType;
	auditReason: string | null;
}

export interface ModerationError {
	message: string;
}

// Keep moderation state changes deterministic and testable before they are
// persisted from the admin router.
export function buildModerationUpdate(
	input: BuildModerationUpdateInput,
): ModerationUpdateResult | ModerationError {
	if (input.actorUserId === input.targetUserId) {
		return { message: "Admins cannot moderate their own account" };
	}

	const trimmedReason = input.reason.trim();

	if (input.action === "ban") {
		if (!trimmedReason) {
			return { message: "A ban reason is required" };
		}

		return {
			userPatch: {
				status: "banned",
				bannedAt: input.now,
				banReason: trimmedReason,
				bannedByUserId: input.actorUserId,
			},
			auditAction: "ban_user",
			auditReason: trimmedReason,
		};
	}

	return {
		userPatch: {
			status: "active",
			bannedAt: null,
			banReason: null,
			bannedByUserId: null,
		},
		auditAction: "unban_user",
		auditReason: trimmedReason || null,
	};
}
