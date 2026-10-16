import { describe, expect, it } from "bun:test";
import { api, authHeaders, registerUser, uid } from "./helpers";

async function createWorkspace(token: string) {
	const { data } = await api("/workspaces", {
		method: "POST",
		headers: { "Content-Type": "application/json", ...authHeaders(token) },
		body: JSON.stringify({ name: `ws-${uid()}` }),
	});
	return data.workspace.id;
}

describe("Projects", () => {
	it("creates a project", async () => {
		const { token } = await registerUser();
		const workspaceId = await createWorkspace(token);
		const title = `proj-${uid()}`;
		const { res, data } = await api("/projects", {
			method: "POST",
			headers: { "Content-Type": "application/json", ...authHeaders(token) },
			body: JSON.stringify({ workspaceId, title, visibility: "private" }),
		});
		expect(res.status).toBe(201);
		expect(data.project.title).toBe(title);
	});

	it("lists projects with/without workspace filter", async () => {
		const { token } = await registerUser();
		const workspaceId = await createWorkspace(token);
		await api("/projects", {
			method: "POST",
			headers: { "Content-Type": "application/json", ...authHeaders(token) },
			body: JSON.stringify({ workspaceId, title: `proj-${uid()}` }),
		});
		const { res: r1, data: d1 } = await api(
			`/projects?workspaceId=${workspaceId}`,
			{
				headers: authHeaders(token),
			},
		);
		expect(r1.status).toBe(200);
		expect(d1.projects.length).toBeGreaterThanOrEqual(1);
		const { res: r2, data: d2 } = await api("/projects", {
			headers: authHeaders(token),
		});
		expect(r2.status).toBe(200);
		expect(Array.isArray(d2.projects)).toBe(true);
	});

	it("gets, updates, deletes project", async () => {
		const { token } = await registerUser();
		const workspaceId = await createWorkspace(token);
		const { data: createData } = await api("/projects", {
			method: "POST",
			headers: { "Content-Type": "application/json", ...authHeaders(token) },
			body: JSON.stringify({ workspaceId, title: `proj-${uid()}` }),
		});
		const id = createData.project.id;
		const { res: getRes, data: getData } = await api(`/projects/${id}`, {
			headers: authHeaders(token),
		});
		expect(getRes.status).toBe(200);
		expect(getData.project.id).toBe(id);
		const newTitle = `proj-upd-${uid()}`;
		const { res: updRes, data: updData } = await api(`/projects/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json", ...authHeaders(token) },
			body: JSON.stringify({ title: newTitle }),
		});
		expect(updRes.status).toBe(200);
		expect(updData.updated.title).toBe(newTitle);
		const { res: delRes } = await api(`/projects/${id}`, {
			method: "DELETE",
			headers: authHeaders(token),
		});
		expect(delRes.status).toBe(204);
	});

	it("forbids non-member project access", async () => {
		const owner = await registerUser();
		const other = await registerUser();
		const workspaceId = await createWorkspace(owner.token);
		const { data } = await api("/projects", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...authHeaders(owner.token),
			},
			body: JSON.stringify({ workspaceId, title: `proj-${uid()}` }),
		});
		const id = data.project.id;
		const { res } = await api(`/projects/${id}`, {
			headers: authHeaders(other.token),
		});
		expect(res.status).toBe(403);
	});
});
