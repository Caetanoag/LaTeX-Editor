import { describe, expect, it } from "bun:test";
import { api, authHeaders, registerUser, TEST_PASSWORD } from "./helpers";

const login = async (email: string, password = TEST_PASSWORD) => {
	const { res, data } = await api("/auth/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email, password }),
	});
	if (!res.ok) throw new Error(`Login failed: ${JSON.stringify(data)}`);
	return data.session.token as string;
};

describe("Account sessions", () => {
	it("lists valid sessions with masked tokens and marks the current one", async () => {
		const account = await registerUser();
		const secondToken = await login(account.email);

		const { res, data } = await api("/auth/sessions", {
			headers: authHeaders(account.token),
		});

		expect(res.status).toBe(200);
		expect(data.sessions.length).toBe(2);
		expect(
			data.sessions.every((s: { maskedToken: string }) =>
				/^…[a-f0-9]{4}$/.test(s.maskedToken),
			),
		).toBe(true);
		expect(
			data.sessions.filter((s: { isCurrent: boolean }) => s.isCurrent).length,
		).toBe(1);
		expect(secondToken).toBeTruthy();
	});

	it("revokes a specific session", async () => {
		const account = await registerUser();
		const secondToken = await login(account.email);
		const listed = await api("/auth/sessions", {
			headers: authHeaders(secondToken),
		});
		const other = listed.data.sessions.find(
			(s: { isCurrent: boolean }) => !s.isCurrent,
		);

		const { res } = await api(`/auth/sessions/${other.id}`, {
			method: "DELETE",
			headers: authHeaders(secondToken),
		});
		expect(res.status).toBe(204);

		const revoked = await api("/auth/me", {
			headers: authHeaders(account.token),
		});
		expect(revoked.status).toBe(401);
		const current = await api("/auth/me", {
			headers: authHeaders(secondToken),
		});
		expect(current.status).toBe(200);
	});

	it("logs out from all devices", async () => {
		const account = await registerUser();
		const secondToken = await login(account.email);

		const { res } = await api("/auth/logout-all", {
			method: "POST",
			headers: authHeaders(account.token),
		});
		expect(res.status).toBe(204);

		const first = await api("/auth/me", {
			headers: authHeaders(account.token),
		});
		const second = await api("/auth/me", {
			headers: authHeaders(secondToken),
		});
		expect(first.status).toBe(401);
		expect(second.status).toBe(401);
	});
});

describe("Delete account", () => {
	it("rejects a wrong password", async () => {
		const account = await registerUser();
		const { res, data } = await api("/auth/account", {
			method: "DELETE",
			headers: {
				...authHeaders(account.token),
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ password: "wrong-password" }),
		});
		expect(res.status).toBe(401);
		expect(data.error).toBe("invalid_credentials");
	});

	it("validates that a password is provided", async () => {
		const account = await registerUser();
		const { res } = await api("/auth/account", {
			method: "DELETE",
			headers: {
				...authHeaders(account.token),
				"Content-Type": "application/json",
			},
			body: JSON.stringify({}),
		});
		expect(res.status).toBe(400);
	});

	it("deactivates the account and removes its sessions", async () => {
		const account = await registerUser();
		const observer = await registerUser();

		const { res } = await api("/auth/account", {
			method: "DELETE",
			headers: {
				...authHeaders(account.token),
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ password: account.password }),
		});
		expect(res.status).toBe(204);

		const me = await api("/auth/me", {
			headers: authHeaders(account.token),
		});
		expect(me.status).toBe(401);

		const lookup = await api(`/users/${account.user.id}`, {
			headers: authHeaders(observer.token),
		});
		expect(lookup.status).toBe(404);
	});
});
