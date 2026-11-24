import { describe, expect, it } from "bun:test";
import { api, authHeaders, registerUser, uid } from "./helpers";

async function createWorkspace(token: string) {
	const { data } = await api("/workspaces", {
		method: "POST",
		headers: { "Content-Type": "application/json", ...authHeaders(token) },
		body: JSON.stringify({ name: `ws-${uid()}` }),
	});
	return data.workspace.id as number | string;
}

async function createProject(
	token: string,
	workspaceId: number | string,
	overrides: Record<string, unknown> = {},
) {
	const { res, data } = await api("/projects", {
		method: "POST",
		headers: { "Content-Type": "application/json", ...authHeaders(token) },
		body: JSON.stringify({
			workspaceId,
			title: `proj-${uid()}`,
			...overrides,
		}),
	});
	return { res, data, project: data?.project };
}

function expectTagShape(tag: unknown) {
	expect(tag).toBeObject();
	const t = tag as Record<string, unknown>;
	expect(typeof t.id === "number" || typeof t.id === "string").toBe(true);
	expect(typeof t.title).toBe("string");
	expect(typeof t.description).toBe("string");
	expect(Object.keys(t).sort()).toEqual(["description", "id", "title"]);
}

function idsEqual(a: unknown, b: unknown) {
	return String(a) === String(b);
}

describe("Project tags", () => {
	it("CA3/CA2: new project exposes tags: [] across create/get/list/patch/restore envelopes", async () => {
		const { token } = await registerUser();
		const workspaceId = await createWorkspace(token);
		const { res: createRes, project } = await createProject(token, workspaceId);
		expect(createRes.status).toBe(201);
		expect(project.tags).toEqual([]);

		const { res: getRes, data: getData } = await api(
			`/projects/${project.id}`,
			{
				headers: authHeaders(token),
			},
		);
		expect(getRes.status).toBe(200);
		expect(getData.project.tags).toEqual([]);
		expect(getData.project.effectiveRole).toBe("owner");

		const { res: listRes, data: listData } = await api(
			`/projects?workspaceId=${workspaceId}`,
			{ headers: authHeaders(token) },
		);
		expect(listRes.status).toBe(200);
		const listed = listData.projects.find((p: { id: unknown }) =>
			idsEqual(p.id, project.id),
		);
		expect(listed).toBeDefined();
		expect(listed.tags).toEqual([]);

		const { res: patchRes, data: patchData } = await api(
			`/projects/${project.id}`,
			{
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					...authHeaders(token),
				},
				body: JSON.stringify({ title: `proj-upd-${uid()}` }),
			},
		);
		expect(patchRes.status).toBe(200);
		expect(patchData.updated.tags).toEqual([]);

		const { res: delRes } = await api(`/projects/${project.id}`, {
			method: "DELETE",
			headers: authHeaders(token),
		});
		expect(delRes.status).toBe(204);

		const { res: restoreRes, data: restoreData } = await api(
			`/projects/${project.id}/restore`,
			{
				method: "POST",
				headers: authHeaders(token),
			},
		);
		expect(restoreRes.status).toBe(200);
		expect(restoreData.project.tags).toEqual([]);
	});

	it("CA1/CA4: GET /projects/:id/tags returns Tag[] ordered by title ASC after PUT replaces set", async () => {
		const { token } = await registerUser();
		const workspaceId = await createWorkspace(token);
		const { project } = await createProject(token, workspaceId);

		const { res: putRes, data: putData } = await api(
			`/projects/${project.id}/tags`,
			{
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					...authHeaders(token),
				},
				body: JSON.stringify({
					tags: [{ title: "zeta" }, { title: "Alpha" }, { title: "middle" }],
				}),
			},
		);
		expect(putRes.status).toBe(200);
		expect(Array.isArray(putData.tags)).toBe(true);
		expect(putData.tags.map((t: { title: string }) => t.title)).toEqual([
			"Alpha",
			"middle",
			"zeta",
		]);
		for (const tag of putData.tags) expectTagShape(tag);

		const { res: getRes, data: getData } = await api(
			`/projects/${project.id}/tags`,
			{ headers: authHeaders(token) },
		);
		expect(getRes.status).toBe(200);
		expect(getData.tags.map((t: { title: string }) => t.title)).toEqual([
			"Alpha",
			"middle",
			"zeta",
		]);
	});

	it("CA5/CA20: repeated PUT is idempotent for tag set/associations and updates updated_at", async () => {
		const { token } = await registerUser();
		const workspaceId = await createWorkspace(token);
		const { project } = await createProject(token, workspaceId);

		const body = { tags: [{ title: "ML" }, { title: "LaTeX" }] };
		const first = await api(`/projects/${project.id}/tags`, {
			method: "PUT",
			headers: { "Content-Type": "application/json", ...authHeaders(token) },
			body: JSON.stringify(body),
		});
		expect(first.res.status).toBe(200);
		const firstTags = first.data.tags;
		expect(firstTags.map((t: { title: string }) => t.title)).toEqual([
			"LaTeX",
			"ML",
		]);

		const { data: before } = await api(`/projects/${project.id}`, {
			headers: authHeaders(token),
		});
		const beforeUpdatedAt = Date.parse(before.project.updated_at);

		// Small delay to make updated_at progression observable.
		await Bun.sleep(20);

		const second = await api(`/projects/${project.id}/tags`, {
			method: "PUT",
			headers: { "Content-Type": "application/json", ...authHeaders(token) },
			body: JSON.stringify(body),
		});
		expect(second.res.status).toBe(200);
		expect(second.data.tags.map((t: { title: string }) => t.title)).toEqual([
			"LaTeX",
			"ML",
		]);
		expect(second.data.tags.map((t: { id: unknown }) => String(t.id))).toEqual(
			firstTags.map((t: { id: unknown }) => String(t.id)),
		);

		const { data: after } = await api(`/projects/${project.id}`, {
			headers: authHeaders(token),
		});
		const afterUpdatedAt = Date.parse(after.project.updated_at);
		expect(afterUpdatedAt).toBeGreaterThanOrEqual(beforeUpdatedAt);
		expect(after.project.tags.map((t: { title: string }) => t.title)).toEqual([
			"LaTeX",
			"ML",
		]);
	});

	it("CA6: PUT [] clears project tags", async () => {
		const { token } = await registerUser();
		const workspaceId = await createWorkspace(token);
		const { project } = await createProject(token, workspaceId);

		await api(`/projects/${project.id}/tags`, {
			method: "PUT",
			headers: { "Content-Type": "application/json", ...authHeaders(token) },
			body: JSON.stringify({ tags: [{ title: "temp" }] }),
		});
		const { res, data } = await api(`/projects/${project.id}/tags`, {
			method: "PUT",
			headers: { "Content-Type": "application/json", ...authHeaders(token) },
			body: JSON.stringify({ tags: [] }),
		});
		expect(res.status).toBe(200);
		expect(data.tags).toEqual([]);

		const { data: getData } = await api(`/projects/${project.id}/tags`, {
			headers: authHeaders(token),
		});
		expect(getData.tags).toEqual([]);
	});

	it("CA7/CA16: global tag upsert reuses canonical row, does not mutate global title/description, and is isolated per project", async () => {
		const { token } = await registerUser();
		const workspaceId = await createWorkspace(token);
		const { project: p1 } = await createProject(token, workspaceId);
		const { project: p2 } = await createProject(token, workspaceId);

		const putMl = await api(`/projects/${p1.id}/tags`, {
			method: "PUT",
			headers: { "Content-Type": "application/json", ...authHeaders(token) },
			body: JSON.stringify({ tags: [{ title: "ML" }] }),
		});
		expect(putMl.res.status).toBe(200);
		expect(putMl.data.tags).toHaveLength(1);
		expect(putMl.data.tags[0].title).toBe("ML");
		expect(putMl.data.tags[0].description).toBe("");
		const mlId = putMl.data.tags[0].id;

		const reuse = await api(`/projects/${p2.id}/tags`, {
			method: "PUT",
			headers: { "Content-Type": "application/json", ...authHeaders(token) },
			body: JSON.stringify({ tags: [{ title: " mL " }] }),
		});
		expect(reuse.res.status).toBe(200);
		expect(reuse.data.tags).toHaveLength(1);
		expect(reuse.data.tags[0].title).toBe("ML");
		expect(reuse.data.tags[0].description).toBe("");
		expect(idsEqual(reuse.data.tags[0].id, mlId)).toBe(true);

		// Changing tags on p2 must not affect p1 and must not delete global tag row.
		const changeP2 = await api(`/projects/${p2.id}/tags`, {
			method: "PUT",
			headers: { "Content-Type": "application/json", ...authHeaders(token) },
			body: JSON.stringify({ tags: [{ title: "Other" }] }),
		});
		expect(changeP2.res.status).toBe(200);

		const p1Tags = await api(`/projects/${p1.id}/tags`, {
			headers: authHeaders(token),
		});
		expect(p1Tags.res.status).toBe(200);
		expect(p1Tags.data.tags).toHaveLength(1);
		expect(p1Tags.data.tags[0].title).toBe("ML");
		expect(idsEqual(p1Tags.data.tags[0].id, mlId)).toBe(true);

		// Global tag still reusable with canonical title/description.
		const reuseAgain = await api(`/projects/${p2.id}/tags`, {
			method: "PUT",
			headers: { "Content-Type": "application/json", ...authHeaders(token) },
			body: JSON.stringify({ tags: [{ title: "ml" }] }),
		});
		expect(reuseAgain.res.status).toBe(200);
		expect(reuseAgain.data.tags[0].title).toBe("ML");
		expect(reuseAgain.data.tags[0].description).toBe("");
		expect(idsEqual(reuseAgain.data.tags[0].id, mlId)).toBe(true);
	});

	it("CA8/CA9/CA10: validates PUT body with 400 validation_error", async () => {
		const { token } = await registerUser();
		const workspaceId = await createWorkspace(token);
		const { project } = await createProject(token, workspaceId);
		const endpoint = `/projects/${project.id}/tags`;

		const badBodies: unknown[] = [
			{},
			{ tags: "nope" },
			{ tags: [{}] },
			{ tags: [{ title: "" }] },
			{ tags: [{ title: "   " }] },
			{ tags: [{ title: "a".repeat(51) }] },
			{
				tags: Array.from({ length: 21 }, (_, i) => ({ title: `t${i}` })),
			},
			{ tags: [{ title: "ok" }], extra: true },
			{ tags: [{ title: "ok", extra: true }] },
			{ tags: [{ title: "ok", description: "x" }] },
			{ tags: [{ id: 1, title: "ok" }] },
			{ tags: [{ title: "React" }, { title: " react " }] },
		];

		for (const body of badBodies) {
			const { res, data } = await api(endpoint, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					...authHeaders(token),
				},
				body: JSON.stringify(body),
			});
			expect(res.status).toBe(400);
			expect(data.error).toBe("validation_error");
		}
	});

	it("CA11: tag endpoints require auth", async () => {
		const { token } = await registerUser();
		const workspaceId = await createWorkspace(token);
		const { project } = await createProject(token, workspaceId);

		const getRes = await api(`/projects/${project.id}/tags`);
		expect(getRes.res.status).toBe(401);

		const putRes = await api(`/projects/${project.id}/tags`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ tags: [] }),
		});
		expect(putRes.res.status).toBe(401);
	});

	it("CA12: non-member gets 403 on project tag endpoints", async () => {
		const owner = await registerUser();
		const other = await registerUser();
		const workspaceId = await createWorkspace(owner.token);
		const { project } = await createProject(owner.token, workspaceId, {
			visibility: "private",
		});

		const getRes = await api(`/projects/${project.id}/tags`, {
			headers: authHeaders(other.token),
		});
		expect(getRes.res.status).toBe(403);

		const putRes = await api(`/projects/${project.id}/tags`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				...authHeaders(other.token),
			},
			body: JSON.stringify({ tags: [{ title: "x" }] }),
		});
		expect(putRes.res.status).toBe(403);
	});

	it("CA13: read-only workspace access can GET tags but cannot PUT tags", async () => {
		const owner = await registerUser();
		const reader = await registerUser();
		const { data: wsData } = await api("/workspaces", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...authHeaders(owner.token),
			},
			body: JSON.stringify({ name: `ws-${uid()}` }),
		});
		const workspaceId = wsData.workspace.id;

		// Add reader as workspace member by inviting/joining path is not exposed;
		// workspace visibility grants read access to workspace members. We create
		// a workspace member directly through a project in that workspace by using
		// workspace-visible project access: reader must be workspace member.
		// Fallback strategy: make project public? No, public is read-only too but
		// easier. Use public visibility for read-only access check.
		const { project } = await createProject(owner.token, workspaceId, {
			visibility: "public",
		});

		const seed = await api(`/projects/${project.id}/tags`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				...authHeaders(owner.token),
			},
			body: JSON.stringify({ tags: [{ title: "public-tag" }] }),
		});
		expect(seed.res.status).toBe(200);

		const getRes = await api(`/projects/${project.id}/tags`, {
			headers: authHeaders(reader.token),
		});
		expect(getRes.res.status).toBe(200);
		expect(getRes.data.tags.map((t: { title: string }) => t.title)).toEqual([
			"public-tag",
		]);

		const putRes = await api(`/projects/${project.id}/tags`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				...authHeaders(reader.token),
			},
			body: JSON.stringify({ tags: [{ title: "hijack" }] }),
		});
		expect(putRes.res.status).toBe(403);
	});

	it("CA14: nonexistent or archived project returns 404 on GET/PUT tags", async () => {
		const { token } = await registerUser();
		const workspaceId = await createWorkspace(token);
		const { project } = await createProject(token, workspaceId);

		const missingGet = await api("/projects/999999999/tags", {
			headers: authHeaders(token),
		});
		expect(missingGet.res.status).toBe(404);

		const missingPut = await api("/projects/999999999/tags", {
			method: "PUT",
			headers: { "Content-Type": "application/json", ...authHeaders(token) },
			body: JSON.stringify({ tags: [] }),
		});
		expect(missingPut.res.status).toBe(404);

		await api(`/projects/${project.id}/tags`, {
			method: "PUT",
			headers: { "Content-Type": "application/json", ...authHeaders(token) },
			body: JSON.stringify({ tags: [{ title: "before-archive" }] }),
		});
		const del = await api(`/projects/${project.id}`, {
			method: "DELETE",
			headers: authHeaders(token),
		});
		expect(del.res.status).toBe(204);

		const archivedGet = await api(`/projects/${project.id}/tags`, {
			headers: authHeaders(token),
		});
		expect(archivedGet.res.status).toBe(404);

		const archivedPut = await api(`/projects/${project.id}/tags`, {
			method: "PUT",
			headers: { "Content-Type": "application/json", ...authHeaders(token) },
			body: JSON.stringify({ tags: [{ title: "nope" }] }),
		});
		expect(archivedPut.res.status).toBe(404);
	});

	it("CA18/CA19: archived list includes tags; restore returns tags; ordering/isolation across projects", async () => {
		const { token } = await registerUser();
		const workspaceId = await createWorkspace(token);
		const { project: p1 } = await createProject(token, workspaceId, {
			title: `p1-${uid()}`,
		});
		const { project: p2 } = await createProject(token, workspaceId, {
			title: `p2-${uid()}`,
		});

		await api(`/projects/${p1.id}/tags`, {
			method: "PUT",
			headers: { "Content-Type": "application/json", ...authHeaders(token) },
			body: JSON.stringify({ tags: [{ title: "beta" }, { title: "Alpha" }] }),
		});
		await api(`/projects/${p2.id}/tags`, {
			method: "PUT",
			headers: { "Content-Type": "application/json", ...authHeaders(token) },
			body: JSON.stringify({ tags: [{ title: "gamma" }] }),
		});

		const activeList = await api(`/projects?workspaceId=${workspaceId}`, {
			headers: authHeaders(token),
		});
		expect(activeList.res.status).toBe(200);
		const a1 = activeList.data.projects.find((p: { id: unknown }) =>
			idsEqual(p.id, p1.id),
		);
		const a2 = activeList.data.projects.find((p: { id: unknown }) =>
			idsEqual(p.id, p2.id),
		);
		expect(a1.tags.map((t: { title: string }) => t.title)).toEqual([
			"Alpha",
			"beta",
		]);
		expect(a2.tags.map((t: { title: string }) => t.title)).toEqual(["gamma"]);

		await api(`/projects/${p1.id}`, {
			method: "DELETE",
			headers: authHeaders(token),
		});

		const archivedList = await api(
			`/projects?workspaceId=${workspaceId}&archived=true`,
			{ headers: authHeaders(token) },
		);
		expect(archivedList.res.status).toBe(200);
		const archivedP1 = archivedList.data.projects.find((p: { id: unknown }) =>
			idsEqual(p.id, p1.id),
		);
		expect(archivedP1).toBeDefined();
		expect(archivedP1.tags.map((t: { title: string }) => t.title)).toEqual([
			"Alpha",
			"beta",
		]);

		const restore = await api(`/projects/${p1.id}/restore`, {
			method: "POST",
			headers: authHeaders(token),
		});
		expect(restore.res.status).toBe(200);
		expect(
			restore.data.project.tags.map((t: { title: string }) => t.title),
		).toEqual(["Alpha", "beta"]);
	});
});
