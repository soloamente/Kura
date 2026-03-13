import { describe, expect, test } from "bun:test";
import { buildModerationUpdate } from "./admin-moderation";

describe("admin moderation", () => {
	test("builds a ban update with audit metadata", () => {
		const now = new Date("2026-03-11T12:00:00.000Z");

		const result = buildModerationUpdate({
			action: "ban",
			actorUserId: "admin_1",
			targetUserId: "user_1",
			reason: "Spam and abusive behavior",
			now,
		});

		expect("message" in result).toBe(false);
		if ("message" in result) return;

		expect(result.userPatch.status).toBe("banned");
		expect(result.userPatch.bannedAt).toEqual(now);
		expect(result.userPatch.banReason).toBe("Spam and abusive behavior");
		expect(result.userPatch.bannedByUserId).toBe("admin_1");
		expect(result.auditAction).toBe("ban_user");
	});

	test("builds an unban update that clears moderation fields", () => {
		const result = buildModerationUpdate({
			action: "unban",
			actorUserId: "admin_1",
			targetUserId: "user_1",
			reason: "",
			now: new Date("2026-03-11T12:00:00.000Z"),
		});

		expect("message" in result).toBe(false);
		if ("message" in result) return;

		expect(result.userPatch.status).toBe("active");
		expect(result.userPatch.bannedAt).toBeNull();
		expect(result.userPatch.banReason).toBeNull();
		expect(result.userPatch.bannedByUserId).toBeNull();
		expect(result.auditAction).toBe("unban_user");
	});

	test("rejects self moderation", () => {
		const result = buildModerationUpdate({
			action: "ban",
			actorUserId: "admin_1",
			targetUserId: "admin_1",
			reason: "Nope",
			now: new Date("2026-03-11T12:00:00.000Z"),
		});

		expect(result).toEqual({
			message: "Admins cannot moderate their own account",
		});
	});

	test("requires a reason when banning a user", () => {
		const result = buildModerationUpdate({
			action: "ban",
			actorUserId: "admin_1",
			targetUserId: "user_1",
			reason: "   ",
			now: new Date("2026-03-11T12:00:00.000Z"),
		});

		expect(result).toEqual({
			message: "A ban reason is required",
		});
	});
});
