export const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

export function uid(): string {
	return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function randomEmail(): string {
	return `test-${uid()}@example.com`;
}

export function randomUsername(): string {
	return `u_${uid()}`.slice(0, 30);
}

export const TEST_PASSWORD = "Password123!abc";

export async function api(path: string, init?: RequestInit) {
	const res = await fetch(`${BASE_URL}${path}`, init);
	let data: any = null;
	const ct = res.headers.get("content-type") ?? "";
	if (ct.includes("application/json")) {
		data = await res.json();
	} else if (ct.includes("application/pdf")) {
		data = await res.arrayBuffer();
	} else {
		data = await res.text();
	}
	return { res, data, status: res.status };
}

export async function registerUser() {
	const email = randomEmail();
	const username = randomUsername();
	const password = TEST_PASSWORD;
	const { res, data } = await api("/auth/register", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email, username, password }),
	});
	if (!res.ok) throw new Error(`Register failed: ${JSON.stringify(data)}`);
	return {
		email,
		username,
		password,
		user: data.user,
		token: data.session.token,
	};
}

export function authHeaders(token: string) {
	return { Authorization: `Bearer ${token}` };
}
