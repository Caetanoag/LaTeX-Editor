import { describe, expect, it } from "bun:test";
import { api, authHeaders, registerUser, uid } from "./helpers";

async function setup(token: string) {
	const { data: wsData } = await api("/workspaces", {
		method: "POST",
		headers: { "Content-Type": "application/json", ...authHeaders(token) },
		body: JSON.stringify({ name: `ws-${uid()}` }),
	});
	const workspaceId = wsData.workspace.id;
	const { data: projData } = await api("/projects", {
		method: "POST",
		headers: { "Content-Type": "application/json", ...authHeaders(token) },
		body: JSON.stringify({ workspaceId, title: `proj-${uid()}` }),
	});
	return projData.project.id;
}

describe("Files", () => {
	it("creates a file", async () => {
		const { token } = await registerUser();
		const projectId = await setup(token);
		const filePath = `/main-${uid()}.tex`;
		const { res, data } = await api(`/projects/${projectId}/files`, {
			method: "POST",
			headers: { "Content-Type": "application/json", ...authHeaders(token) },
			body: JSON.stringify({ filePath, fileContent: "Hello", isMain: true }),
		});
		expect(res.status).toBe(201);
		expect(data.file.file_path).toBe(filePath);
	});

	it("lists files", async () => {
		const { token } = await registerUser();
		const projectId = await setup(token);
		await api(`/projects/${projectId}/files`, {
			method: "POST",
			headers: { "Content-Type": "application/json", ...authHeaders(token) },
			body: JSON.stringify({ filePath: `/a-${uid()}.tex`, fileContent: "A" }),
		});
		const { res, data } = await api(`/projects/${projectId}/files`, {
			headers: authHeaders(token),
		});
		expect(res.status).toBe(200);
		expect(Array.isArray(data.files)).toBe(true);
	});

	it("gets, updates, marks main, deletes file", async () => {
		const { token } = await registerUser();
		const projectId = await setup(token);
		const path1 = `/main-${uid()}.tex`;
		const path2 = `/other-${uid()}.tex`;
		const { data: f1 } = await api(`/projects/${projectId}/files`, {
			method: "POST",
			headers: { "Content-Type": "application/json", ...authHeaders(token) },
			body: JSON.stringify({
				filePath: path1,
				fileContent: "Main",
				isMain: true,
			}),
		});
		const { data: f2 } = await api(`/projects/${projectId}/files`, {
			method: "POST",
			headers: { "Content-Type": "application/json", ...authHeaders(token) },
			body: JSON.stringify({ filePath: path2, fileContent: "Other" }),
		});
		const id1 = f1.file.id;
		const id2 = f2.file.id;
		const { res: getRes, data: getData } = await api(`/files/${id1}`, {
			headers: authHeaders(token),
		});
		expect(getRes.status).toBe(200);
		expect(getData.file.id).toBe(id1);
		const newContent = "Updated content";
		const { res: updRes, data: updData } = await api(`/files/${id1}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json", ...authHeaders(token) },
			body: JSON.stringify({ fileContent: newContent }),
		});
		expect(updRes.status).toBe(200);
		expect(updData.file.file_content).toBe(newContent);
		const { res: mainRes, data: mainData } = await api(`/files/${id2}/main`, {
			method: "PATCH",
			headers: authHeaders(token),
		});
		expect(mainRes.status).toBe(200);
		expect(mainData.file.is_main).toBe(true);
		const { res: delRes } = await api(`/files/${id1}`, {
			method: "DELETE",
			headers: authHeaders(token),
		});
		expect(delRes.status).toBe(204);
	});

	it("prevents deleting the only file", async () => {
		const { token } = await registerUser();
		const projectId = await setup(token);
		const { data: f } = await api(`/projects/${projectId}/files`, {
			method: "POST",
			headers: { "Content-Type": "application/json", ...authHeaders(token) },
			body: JSON.stringify({
				filePath: `/only-${uid()}.tex`,
				fileContent: "Only",
				isMain: true,
			}),
		});
		const id = f.file.id;
		const { res, data } = await api(`/files/${id}`, {
			method: "DELETE",
			headers: authHeaders(token),
		});
		expect(res.status).toBe(409);
		expect(data.error).toBe("conflict");
	});

	it("rejects duplicate file path", async () => {
		const { token } = await registerUser();
		const projectId = await setup(token);
		const path = `/dup-${uid()}.tex`;
		await api(`/projects/${projectId}/files`, {
			method: "POST",
			headers: { "Content-Type": "application/json", ...authHeaders(token) },
			body: JSON.stringify({ filePath: path, fileContent: "A" }),
		});
		const { res, data } = await api(`/projects/${projectId}/files`, {
			method: "POST",
			headers: { "Content-Type": "application/json", ...authHeaders(token) },
			body: JSON.stringify({ filePath: path, fileContent: "B" }),
		});
		expect(res.status).toBe(409);
		expect(data.error).toBe("conflict");
	});
});
