import { describe, expect, it } from "bun:test";
import { api, authHeaders, registerUser, uid } from "./helpers";

describe("Workspaces", () => {
	it("creates a workspace", async () => {
		const { token } = await registerUser();
		const name = `ws-${uid()}`;
		const { res, data } = await api("/workspaces", {
			method: "POST",
			headers: { "Content-Type": "application/json", ...authHeaders(token) },
			body: JSON.stringify({ name, description: "desc" }),
		});
		expect(res.status).toBe(201);
		expect(data.workspace.name).toBe(name);
	});

	it("lists workspaces", async () => {
		const { token } = await registerUser();
		const { res, data } = await api("/workspaces", {
			headers: authHeaders(token),
		});
		expect(res.status).toBe(200);
		expect(Array.isArray(data.workspaces)).toBe(true);
	});

	it("gets, updates, deletes workspace", async () => {
		const { token } = await registerUser();
		const name = `ws-${uid()}`;
		const { data: createData } = await api("/workspaces", {
			method: "POST",
			headers: { "Content-Type": "application/json", ...authHeaders(token) },
			body: JSON.stringify({ name }),
		});
		const id = createData.workspace.id;
		const { res: getRes, data: getData } = await api(`/workspaces/${id}`, {
			headers: authHeaders(token),
		});
		expect(getRes.status).toBe(200);
		expect(getData.workspace.id).toBe(id);
		const newName = `ws-upd-${uid()}`;
		const { res: updRes, data: updData } = await api(`/workspaces/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json", ...authHeaders(token) },
			body: JSON.stringify({ name: newName }),
		});
		expect(updRes.status).toBe(200);
		expect(updData.workspace.name).toBe(newName);
		const { res: delRes } = await api(`/workspaces/${id}`, {
			method: "DELETE",
			headers: authHeaders(token),
		});
		expect(delRes.status).toBe(204);
	});

	it("requires auth", async () => {
		const { res } = await api("/workspaces");
		expect(res.status).toBe(401);
	});

	it("forbids non-member access", async () => {
		const owner = await registerUser();
		const other = await registerUser();
		const { data } = await api("/workspaces", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...authHeaders(owner.token),
			},
			body: JSON.stringify({ name: `ws-${uid()}` }),
		});
		const id = data.workspace.id;
		const { res } = await api(`/workspaces/${id}`, {
			headers: authHeaders(other.token),
		});
		expect(res.status).toBe(403);
	});
});
