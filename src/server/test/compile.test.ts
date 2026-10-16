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

describe("Compile", () => {
	it("compiles a valid LaTeX file", async () => {
		const { token } = await registerUser();
		const projectId = await setup(token);
		const { data: fileData } = await api(`/projects/${projectId}/files`, {
			method: "POST",
			headers: { "Content-Type": "application/json", ...authHeaders(token) },
			body: JSON.stringify({
				filePath: `/main-${uid()}.tex`,
				fileContent:
					"\\documentclass{article}\\begin{document}Hello\\end{document}",
				isMain: true,
			}),
		});
		const fileId = fileData.file.id;
		const { res } = await api(`/files/${fileId}/compile`, {
			method: "POST",
			headers: authHeaders(token),
		});
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("application/pdf");
	});

	it("returns error for invalid LaTeX", async () => {
		const { token } = await registerUser();
		const projectId = await setup(token);
		const { data: fileData } = await api(`/projects/${projectId}/files`, {
			method: "POST",
			headers: { "Content-Type": "application/json", ...authHeaders(token) },
			body: JSON.stringify({
				filePath: `/main-${uid()}.tex`,
				fileContent: "\\invalidcommand{",
				isMain: true,
			}),
		});
		const fileId = fileData.file.id;
		const { res, data } = await api(`/files/${fileId}/compile`, {
			method: "POST",
			headers: authHeaders(token),
		});
		expect(res.status).toBe(422);
		expect(data.error).toBe("compile_error");
	});

	it("fails when no main file", async () => {
		const { token } = await registerUser();
		const projectId = await setup(token);
		const { data: fileData } = await api(`/projects/${projectId}/files`, {
			method: "POST",
			headers: { "Content-Type": "application/json", ...authHeaders(token) },
			body: JSON.stringify({
				filePath: `/main-${uid()}.tex`,
				fileContent: "content",
				isMain: false,
			}),
		});
		const fileId = fileData.file.id;
		const { res, data } = await api(`/files/${fileId}/compile`, {
			method: "POST",
			headers: authHeaders(token),
		});
		expect(res.status).toBe(409);
		expect(data.error).toBe("conflict");
	});
});
