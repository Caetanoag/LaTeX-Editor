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

const apiFetch = async <T>(path: string): Promise<T> => {
	const token = authService.getSession()?.token;
	if (!token) throw new Error("No session");

	const response = await fetch(`${window.location.origin}${path}`, {
		headers: { Authorization: `Bearer ${token}` },
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

const initializeDashboard = async (): Promise<void> => {
	try {
		const { workspaces } = await apiFetch<{ workspaces: Workspace[] }>(
			"/workspaces",
		);
		const storedId = localStorage.getItem(WORKSPACE_STORAGE_KEY);
		const selected =
			workspaces.find((workspace) => workspace.id === storedId) ??
			workspaces[0];
		if (!selected) {
			showMessage("No workspaces yet.");
			return;
		}

		localStorage.setItem(WORKSPACE_STORAGE_KEY, String(selected.id));
		if (dashboardHeader) dashboardHeader.textContent = selected.name;
		renderWorkspaceButtons(workspaces, selected.id);
		await loadProjects(selected);
	} catch {
		showMessage("Unable to load workspaces.");
	}
};

if (hasValidSession() && projectsBody) {
	void initializeDashboard();
}
