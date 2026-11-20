import { AuthService } from "./shared/auth";
import { hasValidSession } from "./shared/page-guard";

type Workspace = {
	id: string;
	name: string;
	description: string | null;
	role?: string;
};

type Project = {
	id: string;
	title: string;
	description: string | null;
	visibility: "private" | "workspace" | "public";
	owner_id: string;
	updated_at: string;
};

type Owner = {
	id: string;
	username: string;
};

const WORKSPACE_STORAGE_KEY = "currentWorkspaceId";
const authService = new AuthService(`${window.location.origin}/auth`);
let currentWorkspace: Workspace | undefined;

const projectsBody =
	document.querySelector<HTMLTableSectionElement>("#projects-body");
const workspaceList = document.querySelector<HTMLDivElement>("#workspace-list");
const dashboardMessage =
	document.querySelector<HTMLElement>("#dashboard-message");
const createWorkspaceButton = document.querySelector<HTMLButtonElement>(
	"#create-workspace-button",
);
const workspaceDialog =
	document.querySelector<HTMLDialogElement>("#workspace-dialog");
const createWorkspaceForm = document.querySelector<HTMLFormElement>(
	"#create-workspace-form",
);
const workspaceNameInput =
	document.querySelector<HTMLInputElement>("#workspace-name");
const workspaceDescriptionInput = document.querySelector<HTMLTextAreaElement>(
	"#workspace-description",
);
const workspaceDialogError = document.querySelector<HTMLElement>(
	"#workspace-dialog-error",
);
const cancelWorkspaceButton = document.querySelector<HTMLButtonElement>(
	"#cancel-workspace-button",
);
const submitWorkspaceButton = document.querySelector<HTMLButtonElement>(
	"#submit-workspace-button",
);
const createProjectButton = document.querySelector<HTMLButtonElement>(
	"#create-project-button",
);
const projectDialog =
	document.querySelector<HTMLDialogElement>("#project-dialog");
const createProjectForm = document.querySelector<HTMLFormElement>(
	"#create-project-form",
);
const projectTitleInput =
	document.querySelector<HTMLInputElement>("#project-title");
const projectDescriptionInput = document.querySelector<HTMLTextAreaElement>(
	"#project-description",
);
const projectVisibilitySelect = document.querySelector<HTMLSelectElement>(
	"#project-visibility",
);
const projectDialogError = document.querySelector<HTMLElement>(
	"#project-dialog-error",
);
const cancelProjectButton = document.querySelector<HTMLButtonElement>(
	"#cancel-project-button",
);
const submitProjectButton = document.querySelector<HTMLButtonElement>(
	"#submit-project-button",
);
const dashboardTitle = document.querySelector<HTMLElement>("#dashboard-title");
const archivedButton =
	document.querySelector<HTMLButtonElement>("#archived-button");
const selectionHeader =
	document.querySelector<HTMLTableCellElement>("#selection-header");
const actionsHeader =
	document.querySelector<HTMLTableCellElement>("#actions-header");
const selectionCard = document.querySelector<HTMLElement>("#selection-card");
const selectionCount = document.querySelector<HTMLElement>("#selection-count");
const editProjectButton = document.querySelector<HTMLButtonElement>(
	"#edit-project-button",
);
const archiveProjectsButton = document.querySelector<HTMLButtonElement>(
	"#archive-projects-button",
);
const projectDialogTitle = document.querySelector<HTMLElement>(
	"#project-dialog-title",
);
const workspaceSelectionCard = document.querySelector<HTMLElement>(
	"#workspace-selection-card",
);
const workspaceSelectionName = document.querySelector<HTMLElement>(
	"#workspace-selection-name",
);
const editWorkspaceButton = document.querySelector<HTMLButtonElement>(
	"#edit-workspace-button",
);
const deleteWorkspaceButton = document.querySelector<HTMLButtonElement>(
	"#delete-workspace-button",
);
const workspaceDialogTitle = document.querySelector<HTMLElement>(
	"#workspace-dialog-title",
);

const selectedProjectIds = new Set<string>();
let editingProjectId: string | null = null;
let selectedWorkspaceId: string | null = null;
let editingWorkspaceId: string | null = null;
let showArchived = false;

const showMessage = (message: string): void => {
	if (!dashboardMessage) return;
	dashboardMessage.textContent = message;
	dashboardMessage.classList.remove("hidden");
};

const clearMessage = (): void => {
	if (!dashboardMessage) return;
	dashboardMessage.textContent = "";
	dashboardMessage.classList.add("hidden");
};

const setDialogError = (element: HTMLElement | null, message: string): void => {
	if (!element) return;
	element.textContent = message;
	element.classList.toggle("hidden", message === "");
};

const updateSelectionCard = (): void => {
	const count = selectedProjectIds.size;
	const hasProjects = count > 0;
	selectionCard?.classList.toggle("hidden", !hasProjects || showArchived);
	if (selectionCount) {
		selectionCount.textContent =
			count === 1 ? "1 project selected" : `${count} projects selected`;
	}
	if (editProjectButton) editProjectButton.disabled = count !== 1;
	if (archiveProjectsButton) archiveProjectsButton.disabled = !hasProjects;

	const showWorkspace =
		!showArchived &&
		!hasProjects &&
		selectedWorkspaceId !== null &&
		currentWorkspace?.id === selectedWorkspaceId;
	workspaceSelectionCard?.classList.toggle("hidden", !showWorkspace);
	if (workspaceSelectionName && showWorkspace) {
		workspaceSelectionName.textContent = currentWorkspace?.name ?? "";
	}
	if (editWorkspaceButton) {
		editWorkspaceButton.disabled =
			!showWorkspace ||
			!["owner", "admin"].includes(currentWorkspace?.role ?? "");
	}
	if (deleteWorkspaceButton) {
		deleteWorkspaceButton.disabled =
			!showWorkspace || currentWorkspace?.role !== "owner";
	}
};

const clearSelection = (): void => {
	selectedProjectIds.clear();
	updateSelectionCard();
};

const renderView = (): void => {
	if (selectionHeader) selectionHeader.hidden = showArchived;
	if (actionsHeader)
		actionsHeader.textContent = showArchived ? "Actions" : "Editor";
	if (archivedButton) {
		archivedButton.textContent = showArchived ? "Back to projects" : "Archived";
		archivedButton.setAttribute("aria-pressed", String(showArchived));
	}
	createProjectButton?.classList.toggle("hidden", showArchived);
	if (dashboardTitle) {
		const name = currentWorkspace?.name ?? "No workspace";
		dashboardTitle.textContent = showArchived ? `Archived · ${name}` : name;
	}
	updateSelectionCard();
};

const apiFetch = async <T>(
	path: string,
	init: RequestInit = {},
): Promise<T> => {
	const token = authService.getSession()?.token;
	if (!token) throw new Error("No session");

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
		throw new Error("Unauthorized");
	}
	if (!response.ok) throw new Error(`Request failed with ${response.status}`);
	if (response.status === 204) return undefined as T;
	return (await response.json()) as T;
};

const relativeTime = (isoDate: string): string => {
	const date = new Date(isoDate).getTime();
	if (Number.isNaN(date)) return "unknown";

	const seconds = Math.floor((Date.now() - date) / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);
	const years = Math.floor(days / 365.25);
	const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

	if (Math.abs(years) > 0) return rtf.format(-years, "year");
	if (Math.abs(days) > 0) return rtf.format(-days, "day");
	if (Math.abs(hours) > 0) return rtf.format(-hours, "hour");
	if (Math.abs(minutes) > 0) return rtf.format(-minutes, "minute");
	return rtf.format(-seconds, "second");
};

const textCell = (text: string): HTMLTableCellElement => {
	const cell = document.createElement("td");
	cell.textContent = text;
	return cell;
};

const loadProjects = async (workspace: Workspace): Promise<void> => {
	if (!projectsBody) return;

	clearMessage();
	clearSelection();
	projectsBody.replaceChildren();

	try {
		const query = showArchived
			? `/projects?workspaceId=${workspace.id}&archived=true`
			: `/projects?workspaceId=${workspace.id}`;
		const { projects } = await apiFetch<{ projects: Project[] }>(query);
		if (projects.length === 0) {
			const row = document.createElement("tr");
			const cell = textCell(
				showArchived
					? "No archived projects in this workspace."
					: "No projects in this workspace yet.",
			);
			cell.colSpan = showArchived ? 4 : 5;
			row.appendChild(cell);
			projectsBody.appendChild(row);
			return;
		}

		const ownerIds = [...new Set(projects.map((project) => project.owner_id))];
		const owners = new Map<string, string>();
		await Promise.all(
			ownerIds.map(async (id) => {
				try {
					const { user } = await apiFetch<{ user: Owner }>(`/users/${id}`);
					owners.set(id, user.username);
				} catch {
					owners.set(id, "Unknown");
				}
			}),
		);

		for (const project of projects) {
			const row = document.createElement("tr");

			if (!showArchived) {
				const checkboxCell = document.createElement("td");
				const checkbox = document.createElement("input");
				checkbox.type = "checkbox";
				checkbox.className = "table-checkbox";
				checkbox.dataset.projectId = project.id;
				checkbox.checked = selectedProjectIds.has(project.id);
				checkbox.setAttribute("aria-label", `Select ${project.title}`);
				checkboxCell.appendChild(checkbox);
				row.appendChild(checkboxCell);
			}

			row.appendChild(textCell(project.title));
			row.appendChild(textCell(owners.get(project.owner_id) ?? "Unknown"));
			row.appendChild(textCell(relativeTime(project.updated_at)));

			const actionsCell = document.createElement("td");
			if (showArchived) {
				const restoreButton = document.createElement("button");
				restoreButton.type = "button";
				restoreButton.textContent = "Restore";
				restoreButton.setAttribute("aria-label", `Restore ${project.title}`);
				restoreButton.addEventListener("click", () => {
					void restoreProject(project);
				});
				actionsCell.appendChild(restoreButton);
			} else {
				const editorLink = document.createElement("a");
				editorLink.className = "project-open-link";
				editorLink.href = `./editor.html?projectId=${encodeURIComponent(project.id)}`;
				editorLink.textContent = "Open";
				editorLink.setAttribute(
					"aria-label",
					`Open ${project.title} in the editor`,
				);
				actionsCell.appendChild(editorLink);
			}
			row.appendChild(actionsCell);

			projectsBody.appendChild(row);
		}
	} catch {
		showMessage(
			showArchived
				? "Unable to load archived projects."
				: "Unable to load projects.",
		);
	}
};

const restoreProject = async (project: Project): Promise<void> => {
	if (!window.confirm(`Restore "${project.title}"?`)) return;

	try {
		await apiFetch(`/projects/${project.id}/restore`, { method: "POST" });
		if (currentWorkspace) await loadProjects(currentWorkspace);
		showMessage(`Restored "${project.title}".`);
	} catch {
		showMessage("Unable to restore project.");
	}
};

projectsBody?.addEventListener("change", (event) => {
	const target = event.target;
	if (!(target instanceof HTMLInputElement)) return;
	if (!target.matches(".table-checkbox")) return;

	const projectId = target.dataset.projectId;
	if (!projectId) return;

	if (target.checked) selectedProjectIds.add(projectId);
	else selectedProjectIds.delete(projectId);
	updateSelectionCard();
});

const renderWorkspaceButtons = (
	workspaces: Workspace[],
	selectedId: string,
): void => {
	if (!workspaceList) return;

	workspaceList.replaceChildren();
	for (const workspace of workspaces) {
		const button = document.createElement("button");
		button.type = "button";
		button.textContent = workspace.name;
		button.setAttribute("aria-pressed", String(workspace.id === selectedId));
		button.addEventListener("click", () => {
			currentWorkspace = workspace;
			selectedWorkspaceId = workspace.id;
			localStorage.setItem(WORKSPACE_STORAGE_KEY, String(workspace.id));
			clearSelection();
			renderWorkspaceButtons(workspaces, workspace.id);
			renderView();
			void loadProjects(workspace);
		});
		workspaceList.appendChild(button);
	}
};

const loadWorkspaces = async (preferredId?: string): Promise<void> => {
	clearMessage();
	try {
		const { workspaces } = await apiFetch<{ workspaces: Workspace[] }>(
			"/workspaces",
		);
		const storedId = preferredId ?? localStorage.getItem(WORKSPACE_STORAGE_KEY);
		const selected =
			workspaces.find((workspace) => workspace.id === storedId) ??
			workspaces[0];
		if (!selected) {
			currentWorkspace = undefined;
			selectedWorkspaceId = null;
			clearSelection();
			renderWorkspaceButtons(workspaces, "");
			projectsBody?.replaceChildren();
			renderView();
			showMessage("No workspaces yet.");
			return;
		}

		currentWorkspace = selected;
		localStorage.setItem(WORKSPACE_STORAGE_KEY, selected.id);
		renderWorkspaceButtons(workspaces, selected.id);
		renderView();
		await loadProjects(selected);
	} catch {
		showMessage("Unable to load workspaces.");
	}
};

const createWorkspace = async (
	name: string,
	description: string,
): Promise<Workspace> => {
	const { workspace } = await apiFetch<{ workspace: Workspace }>(
		"/workspaces",
		{
			method: "POST",
			body: JSON.stringify({
				name,
				description: description === "" ? null : description,
			}),
		},
	);
	return workspace;
};

const resetWorkspaceDialog = (): void => {
	editingWorkspaceId = null;
	if (workspaceDialogTitle)
		workspaceDialogTitle.textContent = "Create Workspace";
	if (submitWorkspaceButton) submitWorkspaceButton.textContent = "Create";
	setDialogError(workspaceDialogError, "");
	createWorkspaceForm?.reset();
};

createWorkspaceButton?.addEventListener("click", () => {
	resetWorkspaceDialog();
	workspaceDialog?.showModal();
	workspaceNameInput?.focus();
});

cancelWorkspaceButton?.addEventListener("click", () =>
	workspaceDialog?.close(),
);

const openEditWorkspaceDialog = async (workspaceId: string): Promise<void> => {
	resetWorkspaceDialog();
	if (submitWorkspaceButton) submitWorkspaceButton.disabled = true;
	try {
		const { workspace } = await apiFetch<{ workspace: Workspace }>(
			`/workspaces/${workspaceId}`,
		);
		editingWorkspaceId = workspaceId;
		if (workspaceDialogTitle)
			workspaceDialogTitle.textContent = "Edit Workspace";
		if (submitWorkspaceButton) submitWorkspaceButton.textContent = "Save";
		if (workspaceNameInput) workspaceNameInput.value = workspace.name;
		if (workspaceDescriptionInput)
			workspaceDescriptionInput.value = workspace.description ?? "";
		workspaceDialog?.showModal();
		workspaceNameInput?.focus();
	} catch {
		showMessage("Unable to load workspace.");
	} finally {
		if (submitWorkspaceButton) submitWorkspaceButton.disabled = false;
	}
};

editWorkspaceButton?.addEventListener("click", () => {
	if (!selectedWorkspaceId) return;
	void openEditWorkspaceDialog(selectedWorkspaceId);
});

deleteWorkspaceButton?.addEventListener("click", () => {
	const workspaceId = selectedWorkspaceId;
	if (!workspaceId || currentWorkspace?.id !== workspaceId) return;
	if (!window.confirm(`Delete workspace "${currentWorkspace.name}"?`)) return;

	void (async () => {
		try {
			await apiFetch<void>(`/workspaces/${workspaceId}`, {
				method: "DELETE",
			});
			if (localStorage.getItem(WORKSPACE_STORAGE_KEY) === workspaceId) {
				localStorage.removeItem(WORKSPACE_STORAGE_KEY);
			}
			selectedWorkspaceId = null;
			currentWorkspace = undefined;
			clearSelection();
			await loadWorkspaces();
		} catch {
			showMessage("Unable to delete workspace.");
		}
	})();
});

createWorkspaceForm?.addEventListener("submit", async (event) => {
	event.preventDefault();
	const name = workspaceNameInput?.value.trim() ?? "";
	if (!name) {
		setDialogError(workspaceDialogError, "Name is required.");
		return;
	}

	const description = workspaceDescriptionInput?.value.trim() ?? "";
	const payload = {
		name,
		description: description === "" ? null : description,
	};
	if (submitWorkspaceButton) submitWorkspaceButton.disabled = true;
	try {
		let workspace: Workspace;
		if (editingWorkspaceId) {
			const response = await apiFetch<{ workspace: Workspace }>(
				`/workspaces/${editingWorkspaceId}`,
				{ method: "PATCH", body: JSON.stringify(payload) },
			);
			workspace = response.workspace;
		} else {
			workspace = await createWorkspace(name, description);
		}
		workspaceDialog?.close();
		selectedWorkspaceId = editingWorkspaceId ?? null;
		await loadWorkspaces(workspace.id);
	} catch {
		setDialogError(
			workspaceDialogError,
			editingWorkspaceId
				? "Unable to update workspace."
				: "Unable to create workspace.",
		);
	} finally {
		if (submitWorkspaceButton) submitWorkspaceButton.disabled = false;
	}
});

const resetProjectDialog = (): void => {
	editingProjectId = null;
	if (projectDialogTitle) projectDialogTitle.textContent = "Create Project";
	if (submitProjectButton) submitProjectButton.textContent = "Create";
	setDialogError(projectDialogError, "");
	createProjectForm?.reset();
};

createProjectButton?.addEventListener("click", () => {
	if (!currentWorkspace) {
		showMessage("Create a workspace first.");
		return;
	}

	resetProjectDialog();
	projectDialog?.showModal();
	projectTitleInput?.focus();
});

cancelProjectButton?.addEventListener("click", () => projectDialog?.close());

const openEditProjectDialog = async (projectId: string): Promise<void> => {
	resetProjectDialog();
	if (submitProjectButton) submitProjectButton.disabled = true;
	try {
		const { project } = await apiFetch<{ project: Project }>(
			`/projects/${projectId}`,
		);
		editingProjectId = projectId;
		if (projectDialogTitle) projectDialogTitle.textContent = "Edit Project";
		if (submitProjectButton) submitProjectButton.textContent = "Save";
		if (projectTitleInput) projectTitleInput.value = project.title;
		if (projectDescriptionInput)
			projectDescriptionInput.value = project.description ?? "";
		if (projectVisibilitySelect)
			projectVisibilitySelect.value = project.visibility;
		projectDialog?.showModal();
		projectTitleInput?.focus();
	} catch {
		showMessage("Unable to load project.");
	} finally {
		if (submitProjectButton) submitProjectButton.disabled = false;
	}
};

editProjectButton?.addEventListener("click", () => {
	if (selectedProjectIds.size !== 1) return;
	const [projectId] = selectedProjectIds;
	if (projectId) void openEditProjectDialog(projectId);
});

archivedButton?.addEventListener("click", () => {
	showArchived = !showArchived;
	renderView();
	if (currentWorkspace) void loadProjects(currentWorkspace);
	else projectsBody?.replaceChildren();
});

archiveProjectsButton?.addEventListener("click", () => {
	const projectIds = [...selectedProjectIds];
	if (projectIds.length === 0) return;

	const label =
		projectIds.length === 1 ? "this project" : `${projectIds.length} projects`;
	if (!window.confirm(`Archive ${label}?`)) return;

	void (async () => {
		try {
			await Promise.all(
				projectIds.map((projectId) =>
					apiFetch<void>(`/projects/${projectId}`, { method: "DELETE" }),
				),
			);
			clearSelection();
			if (currentWorkspace) await loadProjects(currentWorkspace);
		} catch {
			showMessage("Unable to archive selected projects.");
		}
	})();
});

createProjectForm?.addEventListener("submit", async (event) => {
	event.preventDefault();
	if (!currentWorkspace && !editingProjectId) return;

	const title = projectTitleInput?.value.trim() ?? "";
	if (!title) {
		setDialogError(projectDialogError, "Title is required.");
		return;
	}

	const description = projectDescriptionInput?.value.trim() ?? "";
	const payload = {
		title,
		description: description === "" ? null : description,
		visibility: projectVisibilitySelect?.value ?? "private",
	};

	if (submitProjectButton) submitProjectButton.disabled = true;
	try {
		if (editingProjectId) {
			await apiFetch<void>(`/projects/${editingProjectId}`, {
				method: "PATCH",
				body: JSON.stringify(payload),
			});
		} else if (currentWorkspace) {
			await apiFetch("/projects", {
				method: "POST",
				body: JSON.stringify({
					workspaceId: currentWorkspace.id,
					...payload,
				}),
			});
		}
		projectDialog?.close();
		clearSelection();
		if (currentWorkspace) await loadProjects(currentWorkspace);
	} catch {
		setDialogError(
			projectDialogError,
			editingProjectId
				? "Unable to update project."
				: "Unable to create project.",
		);
	} finally {
		if (submitProjectButton) submitProjectButton.disabled = false;
	}
});

renderView();

if (hasValidSession() && projectsBody) {
	void loadWorkspaces();
}
