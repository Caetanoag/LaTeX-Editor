import { describe, expect, it } from "bun:test";
import {
	api,
	randomEmail,
	randomUsername,
	registerUser,
	TEST_PASSWORD,
} from "./helpers";

describe("Auth", () => {
	it("registers a new user", async () => {
		const email = randomEmail();
		const username = randomUsername();
		const { res, data } = await api("/auth/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, username, password: TEST_PASSWORD }),
		});
		expect(res.status).toBe(201);
		expect(data.user.email).toBe(email);
		expect(data.session.token).toBeTruthy();
	});

	it("rejects duplicate email", async () => {
		const email = randomEmail();
		const username = randomUsername();
		await api("/auth/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, username, password: TEST_PASSWORD }),
		});
		const { res, data } = await api("/auth/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				email,
				username: randomUsername(),
				password: TEST_PASSWORD,
			}),
		});
		expect(res.status).toBe(409);
		expect(data.error).toBe("email_in_use");
	});

	it("rejects duplicate username", async () => {
		const email = randomEmail();
		const username = randomUsername();
		await api("/auth/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, username, password: TEST_PASSWORD }),
		});
		const { res, data } = await api("/auth/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				email: randomEmail(),
				username,
				password: TEST_PASSWORD,
			}),
		});
		expect(res.status).toBe(409);
		expect(data.error).toBe("username_in_use");
	});

	it("logs in with valid credentials", async () => {
		const email = randomEmail();
		const username = randomUsername();
		await api("/auth/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, username, password: TEST_PASSWORD }),
		});
		const { res, data } = await api("/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password: TEST_PASSWORD }),
		});
		expect(res.status).toBe(200);
		expect(data.session.token).toBeTruthy();
	});

	it("rejects invalid credentials", async () => {
		const { res, data } = await api("/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				email: randomEmail(),
				password: "wrongpassword123",
			}),
		});
		expect(res.status).toBe(401);
		expect(data.error).toBe("invalid_credentials");
	});

	it("gets current user with token", async () => {
		const { token } = await registerUser();
		const { res, data } = await api("/auth/me", {
			headers: { Authorization: `Bearer ${token}` },
		});
		expect(res.status).toBe(200);
		expect(data.user).toBeTruthy();
	});

	it("rejects /me without token", async () => {
		const { res } = await api("/auth/me");
		expect(res.status).toBe(401);
	});

	it("logs out", async () => {
		const { token } = await registerUser();
		const { res } = await api("/auth/logout", {
			method: "POST",
			headers: { Authorization: `Bearer ${token}` },
		});
		expect(res.status).toBe(204);
		const { res: res2 } = await api("/auth/me", {
			headers: { Authorization: `Bearer ${token}` },
		});
		expect(res2.status).toBe(401);
	});

	it("validates registration input", async () => {
		const { res, data } = await api("/auth/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				email: "bad",
				username: "ab",
				password: "short",
			}),
		});
		expect(res.status).toBe(400);
		expect(data.error).toBe("validation_error");
	});
});
