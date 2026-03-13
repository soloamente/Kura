import { describe, expect, test } from "bun:test";
import {
	getActiveUser,
	getAdminUser,
	requireActiveUser,
	requireAdmin,
	requireAuth,
} from "./auth-guards";

function makeSet() {
	return { status: 200 };
}

describe("auth guards", () => {
	test("requireAuth rejects anonymous callers", () => {
		const set = makeSet();

		const result = requireAuth(null, set);

		expect(set.status).toBe(401);
		expect(result).toEqual({ message: "Unauthorized" });
	});

	test("requireActiveUser rejects banned users", () => {
		const set = makeSet();

		const result = requireActiveUser(
			{
				id: "user_1",
				role: "user",
				status: "banned",
			} as const,
			set,
		);

		expect(set.status).toBe(403);
		expect(result).toEqual({ message: "Account is banned" });
	});

	test("requireAdmin rejects non-admin users", () => {
		const set = makeSet();

		const result = requireAdmin(
			{
				id: "user_1",
				role: "user",
				status: "active",
			} as const,
			set,
		);

		expect(set.status).toBe(403);
		expect(result).toEqual({ message: "Admin access required" });
	});

	test("active admins pass all guards", () => {
		const set = makeSet();
		const user = {
			id: "admin_1",
			role: "admin",
			status: "active",
		} as const;

		expect(requireAuth(user, set)).toBeNull();
		expect(requireActiveUser(user, set)).toBeNull();
		expect(requireAdmin(user, set)).toBeNull();
		expect(set.status).toBe(200);
	});

	test("getActiveUser returns the typed user after passing guards", () => {
		const set = makeSet();

		const result = getActiveUser(
			{
				id: "user_1",
				role: "user",
				status: "active",
			} as const,
			set,
		);

		expect(result).toEqual({
			id: "user_1",
			role: "user",
			status: "active",
		});
	});

	test("getAdminUser returns the typed admin after passing guards", () => {
		const set = makeSet();

		const result = getAdminUser(
			{
				id: "admin_1",
				role: "admin",
				status: "active",
			} as const,
			set,
		);

		expect(result).toEqual({
			id: "admin_1",
			role: "admin",
			status: "active",
		});
	});
});
