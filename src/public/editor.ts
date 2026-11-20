import { AuthService } from "./shared/auth";
import { hasValidSession } from "./shared/page-guard";

type Project = {
	id: string;
	title: string;
	effectiveRole: string;
};

type EditorFile = {
	id: string;
	project_id: string;
	file_path: string;
	file_content: string;
	is_main: boolean;
	created_at: string;
	updated_at: string;
};

type FileMeta = Omit<EditorFile, "file_content">;

type TreeNode = {
	name: string;
	path: string;
	children: Map<string, TreeNode>;
	file?: FileMeta;
};

class EditorApiError extends Error {
	constructor(
		message: string,
		public readonly status: number,
		public readonly code: string,
		public readonly log?: string,
	) {
		super(message);
	}
}

const projectId = new URLSearchParams(window.location.search).get("projectId");
const authService = new AuthService(`${window.location.origin}/auth`);

const projectTitle = document.querySelector<HTMLElement>(
	"#editor-project-title",
);
const editorMessage = document.querySelector<HTMLElement>("#editor-message");
const fileTree = document.querySelector<HTMLElement>("#editor-file-tree");
const filePathLabel = document.querySelector<HTMLElement>("#editor-file-path");
const dirtyIndicator = document.querySelector<HTMLElement>(
	"#editor-dirty-indicator",
);
const codeEditor = document.querySelector<HTMLTextAreaElement>("#code-editor");
const pdfPreview = document.querySelector<HTMLIFrameElement>("#pdf-preview");
const compileLog = document.querySelector<HTMLElement>("#compile-log");
const saveButton = document.querySelector<HTMLButtonElement>("#save-button");
const setMainButton =
	document.querySelector<HTMLButtonElement>("#set-main-button");
const deleteFileButton = document.querySelector<HTMLButtonElement>(
	"#delete-file-button",
);
const compileButton =
	document.querySelector<HTMLButtonElement>("#compile-button");
const newFileButton =
	document.querySelector<HTMLButtonElement>("#new-file-button");
const newFileDialog =
	document.querySelector<HTMLDialogElement>("#new-file-dialog");
const newFileForm = document.querySelector<HTMLFormElement>("#new-file-form");
const newFilePathInput =
	document.querySelector<HTMLInputElement>("#new-file-path");
const newFileError = document.querySelector<HTMLElement>("#new-file-error");
const cancelNewFile =
	document.querySelector<HTMLButtonElement>("#cancel-new-file");
const confirmNewFile =
	document.querySelector<HTMLButtonElement>("#confirm-new-file");

let project: Project | undefined;
let files: FileMeta[] = [];
let activeFile: EditorFile | undefined;
let canWrite = false;
let dirty = false;
let pdfObjectUrl: string | null = null;
const collapsedPaths = new Set<string>();

const showMessage = (message: string): void => {
	if (!editorMessage) return;
	editorMessage.textContent = message;
	editorMessage.classList.remove("hidden");
};

const showError = (error: unknown, fallback: string): void => {
	showMessage(error instanceof EditorApiError ? error.message : fallback);
};

const setDirty = (value: boolean): void => {
	dirty = value;
	dirtyIndicator?.classList.toggle("hidden", !value);
};

const toMeta = (file: EditorFile): FileMeta => ({
	id: file.id,
	project_id: file.project_id,
	file_path: file.file_path,
	is_main: file.is_main,
	created_at: file.created_at,
	updated_at: file.updated_at,
});

const errorFromResponse = async (
	response: Response,
): Promise<EditorApiError> => {
	const data = (await response.json().catch(() => undefined)) as
		| { error?: string; message?: string; log?: string }
		| undefined;
	return new EditorApiError(
		data?.message ?? `Request failed with ${response.status}`,
		response.status,
		data?.error ?? "unknown_error",
		data?.log,
	);
};

const authFetch = async (
	path: string,
	init: RequestInit = {},
): Promise<Response> => {
	const token = authService.getSession()?.token;
	if (!token) throw new EditorApiError("No session", 401, "invalid_session");

	const headers = new Headers(init.headers);
	headers.set("Authorization", `Bearer ${token}`);
	if (init.body) headers.set("Content-Type", "application/json");

	const response = await fetch(`${window.location.origin}${path}`, {
		...init,
		headers,
	});

	if (response.status === 401) {
		authService.clearSession();
		window.location.replace(
			new URL("../index.html", window.location.href).toString(),
		);
		throw new EditorApiError("Unauthorized", 401, "invalid_session");
	}
	if (!response.ok) throw await errorFromResponse(response);
	return response;
};

const apiFetch = async <T>(
	path: string,
	init: RequestInit = {},
): Promise<T> => {
	const response = await authFetch(path, init);
	if (response.status === 204) return undefined as T;
	return (await response.json()) as T;
};

const refreshActions = (): void => {
	const opened = activeFile !== undefined;
	const editable = opened && canWrite;
	if (saveButton) saveButton.disabled = !editable;
	if (setMainButton)
		setMainButton.disabled = !editable || activeFile?.is_main === true;
	if (deleteFileButton) deleteFileButton.disabled = !editable;
	if (newFileButton) newFileButton.disabled = !canWrite;
	if (compileButton) compileButton.disabled = !opened;
	if (codeEditor) {
		codeEditor.disabled = !opened;
		codeEditor.readOnly = !canWrite;
	}
};

const createNode = (name: string, path: string): TreeNode => ({
	name,
	path,
	children: new Map<string, TreeNode>(),
});

const buildTree = (items: FileMeta[]): TreeNode => {
	const root = createNode("", "");
	for (const file of items) {
		const segments = file.file_path.split("/").filter(Boolean);
		if (segments.length === 0) continue;

		let node = root;
		let prefix = "";
		for (const segment of segments.slice(0, -1)) {
			prefix += `/${segment}`;
			let child = node.children.get(segment);
			if (!child) {
				child = createNode(segment, prefix);
				node.children.set(segment, child);
			}
			node = child;
		}

		const name = segments[segments.length - 1] ?? "";
		let leaf = node.children.get(name);
		if (!leaf) {
			leaf = createNode(name, `${prefix}/${name}`);
			node.children.set(name, leaf);
		}
		leaf.file = file;
	}
	return root;
};

const sortedChildren = (node: TreeNode): TreeNode[] =>
	[...node.children.values()].sort((left, right) => {
		const leftIsFolder = left.children.size > 0 ? 0 : 1;
		const rightIsFolder = right.children.size > 0 ? 0 : 1;
		return leftIsFolder - rightIsFolder || left.name.localeCompare(right.name);
	});

const appendNode = (
	container: HTMLElement,
	node: TreeNode,
	prefix: string,
	isLast: boolean,
	isRoot: boolean,
): void => {
	if (!isRoot) {
		const row = document.createElement("div");
		row.className = "tree-row";

		const branch = document.createElement("span");
		branch.className = "tree-prefix";
		branch.textContent = `${prefix}${isLast ? "└── " : "├── "}`;
		row.appendChild(branch);

		if (node.file) {
			const file = node.file;
			const button = document.createElement("button");
			button.type = "button";
			button.className = "tree-file";
			button.textContent = node.name;
			button.title = file.file_path;
			if (file.id === activeFile?.id) {
				button.setAttribute("aria-current", "true");
			}
			button.addEventListener("click", () => {
				void openFile(file);
			});
			row.appendChild(button);

			if (file.is_main) {
				const badge = document.createElement("span");
				badge.className = "tree-main-badge";
				badge.textContent = "main";
				row.appendChild(badge);
			}
		} else {
			const label = document.createElement("button");
			label.type = "button";
			label.className = "tree-directory";
			const collapsed = collapsedPaths.has(node.path);
			label.textContent = `${collapsed ? "▸" : "▾"} ${node.name}/`;
			label.setAttribute("aria-expanded", String(!collapsed));
			label.title = node.path;
			label.addEventListener("click", () => {
				if (collapsed) collapsedPaths.delete(node.path);
				else collapsedPaths.add(node.path);
				renderTree();
			});
			row.appendChild(label);
		}

		container.appendChild(row);
	}

	if (collapsedPaths.has(node.path)) return;
	const children = sortedChildren(node);
	const nextPrefix = isRoot ? "" : `${prefix}${isLast ? "    " : "│   "}`;
	children.forEach((child, index) => {
		appendNode(
			container,
			child,
			nextPrefix,
			index === children.length - 1,
			false,
		);
	});
};

const renderTree = (): void => {
	if (!fileTree) return;
	fileTree.replaceChildren();

	const root = buildTree(files);
	const rootRow = document.createElement("div");
	rootRow.className = "tree-row tree-root";
	rootRow.textContent = `${project?.title ?? "project"}/`;
	fileTree.appendChild(rootRow);

	if (files.length === 0) {
		const empty = document.createElement("div");
		empty.className = "tree-empty";
		empty.textContent = "No files yet.";
		fileTree.appendChild(empty);
		return;
	}

	const children = sortedChildren(root);
	children.forEach((child, index) => {
		appendNode(fileTree, child, "", index === children.length - 1, false);
	});
};

const openFile = async (file: FileMeta): Promise<void> => {
	if (dirty && !window.confirm("Discard unsaved changes?")) return;
	if (setMainButton) setMainButton.disabled = true;
	if (compileButton) compileButton.disabled = true;

	try {
		const { file: loaded } = await apiFetch<{ file: EditorFile }>(
			`/files/${file.id}`,
		);
		activeFile = loaded;
		if (codeEditor) codeEditor.value = loaded.file_content;
		if (filePathLabel) filePathLabel.textContent = loaded.file_path;
		setDirty(false);
		renderTree();
	} catch (error) {
		showError(error, "Unable to open file.");
	} finally {
		refreshActions();
	}
};

const loadFiles = async (): Promise<void> => {
	if (!projectId) return;
	try {
		const { files: loaded } = await apiFetch<{ files: FileMeta[] }>(
			`/projects/${projectId}/files`,
		);
		files = loaded;
		renderTree();
	} catch (error) {
		showError(error, "Unable to load files.");
	}
	refreshActions();
};

const saveFile = async (announce = true): Promise<void> => {
	if (!activeFile) return;
	const fileId = activeFile.id;
	const fileContent = codeEditor?.value ?? "";

	const { file } = await apiFetch<{ file: EditorFile }>(`/files/${fileId}`, {
		method: "PUT",
		body: JSON.stringify({ fileContent }),
	});

	activeFile = file;
	files = files.map((item) => (item.id === file.id ? toMeta(file) : item));
	setDirty(false);
	renderTree();
	refreshActions();
	if (announce) showMessage(`Saved ${file.file_path}.`);
};

const saveWithFeedback = async (): Promise<void> => {
	try {
		await saveFile();
	} catch (error) {
		showError(error, "Unable to save file.");
	}
};

const setDialogError = (message: string): void => {
	if (!newFileError) return;
	newFileError.textContent = message;
	newFileError.classList.toggle("hidden", message === "");
};

const compile = async (): Promise<void> => {
	if (!activeFile) return;

	if (canWrite) {
		try {
			await saveFile(false);
		} catch (error) {
			showError(error, "Unable to save file before compiling.");
			return;
		}
	}

	if (compileButton) compileButton.disabled = true;
	try {
		const response = await authFetch(`/files/${activeFile.id}/compile`, {
			method: "POST",
		});
		const contentType = response.headers.get("content-type") ?? "";
		if (contentType.includes("application/pdf")) {
			const blob = await response.blob();
			if (pdfObjectUrl) URL.revokeObjectURL(pdfObjectUrl);
			pdfObjectUrl = URL.createObjectURL(blob);
			if (pdfPreview) pdfPreview.src = pdfObjectUrl;
			compileLog?.classList.add("hidden");
			showMessage("PDF compiled.");
		} else {
			const data = (await response.json().catch(() => undefined)) as
				| { message?: string }
				| undefined;
			showMessage(data?.message ?? "Compilation failed.");
		}
	} catch (error) {
		showError(error, "Unable to compile the project.");
		if (error instanceof EditorApiError && error.log && compileLog) {
			compileLog.textContent = error.log;
			compileLog.classList.remove("hidden");
		}
	} finally {
		refreshActions();
	}
};

saveButton?.addEventListener("click", () => {
	void saveWithFeedback();
});

setMainButton?.addEventListener("click", () => {
	const file = activeFile;
	if (!file) return;
	void (async () => {
		try {
			const { file: updated } = await apiFetch<{ file: EditorFile }>(
				`/files/${file.id}/main`,
				{ method: "PATCH" },
			);
			if (activeFile?.id === updated.id) {
				activeFile = { ...activeFile, is_main: true };
			}
			files = files.map((item) => ({
				...item,
				is_main: item.id === updated.id,
			}));
			renderTree();
			refreshActions();
			showMessage(`${updated.file_path} is now the main file.`);
		} catch (error) {
			showError(error, "Unable to set the main file.");
		}
	})();
});

deleteFileButton?.addEventListener("click", () => {
	const file = activeFile;
	if (!file) return;
	if (!window.confirm(`Delete ${file.file_path}?`)) return;

	void (async () => {
		try {
			await apiFetch<void>(`/files/${file.id}`, { method: "DELETE" });
			if (activeFile?.id === file.id) {
				activeFile = undefined;
				if (codeEditor) codeEditor.value = "";
				if (filePathLabel) filePathLabel.textContent = "No file selected";
				setDirty(false);
			}
			await loadFiles();
			const next = files.find((item) => item.is_main) ?? files[0];
			if (next) await openFile(next);
			showMessage(`Deleted ${file.file_path}.`);
		} catch (error) {
			showError(error, "Unable to delete file.");
		} finally {
			refreshActions();
		}
	})();
});

compileButton?.addEventListener("click", () => {
	void compile();
});

newFileButton?.addEventListener("click", () => {
	setDialogError("");
	newFileForm?.reset();
	newFileDialog?.showModal();
	newFilePathInput?.focus();
});

cancelNewFile?.addEventListener("click", () => newFileDialog?.close());

newFileForm?.addEventListener("submit", async (event) => {
	event.preventDefault();
	if (!projectId) return;

	const filePath = newFilePathInput?.value.trim() ?? "";
	if (!filePath) {
		setDialogError("Path is required.");
		return;
	}
	if (confirmNewFile) confirmNewFile.disabled = true;
	try {
		const { file } = await apiFetch<{ file: EditorFile }>(
			`/projects/${projectId}/files`,
			{
				method: "POST",
				body: JSON.stringify({
					filePath,
					fileContent: `% ${filePath}\n\n`,
					isMain: files.length === 0,
				}),
			},
		);
		newFileDialog?.close();
		await loadFiles();
		const created = files.find((item) => item.id === file.id);
		if (created) await openFile(created);
		showMessage(`Created ${file.file_path}.`);
	} catch (error) {
		setDialogError(
			error instanceof EditorApiError
				? error.message
				: "Unable to create file.",
		);
	} finally {
		if (confirmNewFile) confirmNewFile.disabled = false;
	}
});

codeEditor?.addEventListener("input", () => {
	setDirty(true);
	refreshActions();
});

codeEditor?.addEventListener("keydown", (event) => {
	if (event.key === "Tab") {
		if (
			event.currentTarget instanceof HTMLTextAreaElement &&
			event.currentTarget.readOnly
		) {
			return;
		}
		event.preventDefault();
		const textarea = event.currentTarget;
		if (!(textarea instanceof HTMLTextAreaElement)) return;
		textarea.setRangeText(
			"  ",
			textarea.selectionStart,
			textarea.selectionEnd,
			"end",
		);
		setDirty(true);
		refreshActions();
	}
});

document.addEventListener("keydown", (event) => {
	if (document.body.dataset.page !== "editor") return;
	if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") {
		return;
	}
	event.preventDefault();
	if (saveButton?.disabled) return;
	void saveWithFeedback();
});

const initEditor = async (): Promise<void> => {
	if (!projectId) {
		showMessage("Missing project id.");
		return;
	}

	try {
		const { project: loaded } = await apiFetch<{ project: Project }>(
			`/projects/${projectId}`,
		);
		project = loaded;
		canWrite = ["owner", "editor"].includes(loaded.effectiveRole);
		if (projectTitle) projectTitle.textContent = loaded.title;
	} catch (error) {
		showError(error, "Unable to load project.");
		return;
	}

	await loadFiles();
	const preferred =
		files.find((file) => file.is_main) ??
		files.find((file) => file.file_path.endsWith(".tex")) ??
		files[0];
	if (preferred) await openFile(preferred);
};

if (document.body.dataset.page === "editor" && hasValidSession()) {
	void initEditor();
}
