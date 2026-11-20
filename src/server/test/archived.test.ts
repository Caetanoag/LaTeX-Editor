import { describe, expect, it } from "bun:test";
import { api, authHeaders, registerUser, uid } from "./helpers";

async function createWorkspace(token: string): Promise<string> {
	const { data } = await api("/workspaces", {
		method: "POST",
		headers: { "Content-Type": "application/json", ...authHeaders(token) },
		body: JSON.stringify({ name: `ws-${uid()}` }),
	});
	return data.workspace.id;
}

async function createProject(
	token: string,
	workspaceId: string,
	title: string,
): Promise<string> {
	const { data } = await api("/projects", {
		method: "POST",
		headers: { "Content-Type": "application/json", ...authHeaders(token) },
		body: JSON.stringify({ workspaceId, title }),
	});
	return data.project.id;
}

async function archiveProject(token: string, projectId: string): Promise<void> {
	const { res } = await api(`/projects/${projectId}`, {
		method: "DELETE",
		headers: authHeaders(token),
	});
	expect(res.status).toBe(204);
}

describe("Archived projects", () => {
	it("lists archived projects separately from active ones", async () => {
		const { token } = await registerUser();
		const workspaceId = await createWorkspace(token);
		const activeId = await createProject(token, workspaceId, `active-${uid()}`);
		const archivedId = await createProject(
			token,
			workspaceId,
			`archived-${uid()}`,
		);
		await archiveProject(token, archivedId);

		const active = await api(`/projects?workspaceId=${workspaceId}`, {
			headers: authHeaders(token),
		});
		expect(active.status).toBe(200);
		const activeIds = active.data.projects.map(
			(project: { id: string }) => project.id,
		);
		expect(activeIds).toContain(activeId);
		expect(activeIds).not.toContain(archivedId);

		const archived = await api(
			`/projects?workspaceId=${workspaceId}&archived=true`,
			{ headers: authHeaders(token) },
		);
		expect(archived.status).toBe(200);
		expect(
			archived.data.projects.map((project: { id: string }) => project.id),
		).toEqual([archivedId]);
	});

	it("restores an archived project to the active list", async () => {
		const { token } = await registerUser();
		const workspaceId = await createWorkspace(token);
		const projectId = await createProject(token, workspaceId, `proj-${uid()}`);
		await archiveProject(token, projectId);

		const { res, data } = await api(`/projects/${projectId}/restore`, {
			method: "POST",
			headers: authHeaders(token),
		});
		expect(res.status).toBe(200);
		expect(data.project.archived_at).toBeNull();

		const active = await api(`/projects?workspaceId=${workspaceId}`, {
			headers: authHeaders(token),
		});
		expect(
			active.data.projects.map((project: { id: string }) => project.id),
		).toContain(projectId);

		const archived = await api(
			`/projects?workspaceId=${workspaceId}&archived=true`,
			{ headers: authHeaders(token) },
		);
		expect(
			archived.data.projects.map((project: { id: string }) => project.id),
		).not.toContain(projectId);

		const details = await api(`/projects/${projectId}`, {
			headers: authHeaders(token),
		});
		expect(details.status).toBe(200);
	});

	it("forbids a non-owner from restoring an archived project", async () => {
		const owner = await registerUser();
		const other = await registerUser();
		const workspaceId = await createWorkspace(owner.token);
		const projectId = await createProject(
			owner.token,
			workspaceId,
			`proj-${uid()}`,
		);
		await archiveProject(owner.token, projectId);

		const { res } = await api(`/projects/${projectId}/restore`, {
			method: "POST",
			headers: authHeaders(other.token),
		});
		expect(res.status).toBe(403);
	});

	it("rejects restoring a project that is not archived", async () => {
		const { token } = await registerUser();
		const workspaceId = await createWorkspace(token);
		const projectId = await createProject(token, workspaceId, `proj-${uid()}`);

		const { res } = await api(`/projects/${projectId}/restore`, {
			method: "POST",
			headers: authHeaders(token),
		});
		expect(res.status).toBe(404);
	});
});
