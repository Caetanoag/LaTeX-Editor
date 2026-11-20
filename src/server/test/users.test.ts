import { describe, expect, it } from "bun:test";
import { api, authHeaders, registerUser } from "./helpers";

describe("Users", () => {
	it("returns a user by id without sensitive fields", async () => {
		const { user: registered, token } = await registerUser();
		const { res, data } = await api(`/users/${registered.id}`, {
			headers: authHeaders(token),
		});
		expect(res.status).toBe(200);
		expect(data.user.id).toBe(registered.id);
		expect(data.user.username).toBe(registered.username);
		expect(data.user.created_at).toBeTruthy();
		expect(data.user).not.toHaveProperty("email");
		expect(data.user).not.toHaveProperty("password_hash");
	});

	it("allows another authenticated user to read a profile", async () => {
		const target = await registerUser();
		const viewer = await registerUser();
		const { res } = await api(`/users/${target.user.id}`, {
			headers: authHeaders(viewer.token),
		});
		expect(res.status).toBe(200);
	});

	it("returns 404 for an unknown id", async () => {
		const { token } = await registerUser();
		const { res, data } = await api("/users/999999999", {
			headers: authHeaders(token),
		});
		expect(res.status).toBe(404);
		expect(data.error).toBe("not_found");
	});

	it("rejects an invalid id", async () => {
		const { token } = await registerUser();
		const { res, data } = await api("/users/abc", {
			headers: authHeaders(token),
		});
		expect(res.status).toBe(400);
		expect(data.error).toBe("validation_error");
	});

	it("requires authentication", async () => {
		const { user } = await registerUser();
		const { res } = await api(`/users/${user.id}`);
		expect(res.status).toBe(401);
	});
});
