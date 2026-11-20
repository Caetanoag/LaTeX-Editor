import { AuthService } from "./shared/auth";
import { hasValidSession } from "./shared/page-guard";

type Workspace = {
	id: string;
	name: string;
};

type Project = {
	id: string;
	title: string;
	owner_id: string;
	updated_at: string;
};

type Owner = {
	id: string;
	username: string;
};

const WORKSPACE_STORAGE_KEY = "currentWorkspaceId";
const authService = new AuthService(`${window.location.origin}/auth`);

const projectsBody =
	document.querySelector<HTMLTableSectionElement>("#projects-body");
const workspaceList = document.querySelector<HTMLDivElement>("#workspace-list");
const dashboardHeader =
	document.querySelector<HTMLElement>("#dashboard-header");
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

const showDialogError = (message: string): void => {
	if (!workspaceDialogError) return;
	workspaceDialogError.textContent = message;
	workspaceDialogError.classList.remove("hidden");
};

const clearDialogError = (): void => {
	if (!workspaceDialogError) return;
	workspaceDialogError.textContent = "";
	workspaceDialogError.classList.add("hidden");
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
	projectsBody.replaceChildren();

	try {
		const { projects } = await apiFetch<{ projects: Project[] }>(
			`/projects?workspaceId=${workspace.id}`,
		);
		if (projects.length === 0) {
			const row = document.createElement("tr");
			const cell = textCell("No projects in this workspace yet.");
			cell.colSpan = 4;
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

			const checkboxCell = document.createElement("td");
			const checkbox = document.createElement("input");
			checkbox.type = "checkbox";
			checkbox.className = "table-checkbox";
			checkboxCell.appendChild(checkbox);

			row.appendChild(checkboxCell);
			row.appendChild(textCell(project.title));
			row.appendChild(textCell(owners.get(project.owner_id) ?? "Unknown"));
			row.appendChild(textCell(relativeTime(project.updated_at)));
			projectsBody.appendChild(row);
		}
	} catch {
		showMessage("Unable to load projects.");
	}
};

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
			localStorage.setItem(WORKSPACE_STORAGE_KEY, String(workspace.id));
			renderWorkspaceButtons(workspaces, workspace.id);
			if (dashboardHeader) dashboardHeader.textContent = workspace.name;
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
			renderWorkspaceButtons(workspaces, "");
			projectsBody?.replaceChildren();
			if (dashboardHeader) dashboardHeader.textContent = "No workspace";
			showMessage("No workspaces yet.");
			return;
		}

		localStorage.setItem(WORKSPACE_STORAGE_KEY, selected.id);
		if (dashboardHeader) dashboardHeader.textContent = selected.name;
		renderWorkspaceButtons(workspaces, selected.id);
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

createWorkspaceButton?.addEventListener("click", () => {
	clearDialogError();
	createWorkspaceForm?.reset();
	workspaceDialog?.showModal();
	workspaceNameInput?.focus();
});

cancelWorkspaceButton?.addEventListener("click", () =>
	workspaceDialog?.close(),
);

createWorkspaceForm?.addEventListener("submit", async (event) => {
	event.preventDefault();
	const name = workspaceNameInput?.value.trim() ?? "";
	if (!name) {
		showDialogError("Name is required.");
		return;
	}

	const description = workspaceDescriptionInput?.value.trim() ?? "";
	if (submitWorkspaceButton) submitWorkspaceButton.disabled = true;
	try {
		const workspace = await createWorkspace(name, description);
		workspaceDialog?.close();
		await loadWorkspaces(workspace.id);
	} catch {
		showDialogError("Unable to create workspace.");
	} finally {
		if (submitWorkspaceButton) submitWorkspaceButton.disabled = false;
	}
});

if (hasValidSession() && projectsBody) {
	void loadWorkspaces();
}
