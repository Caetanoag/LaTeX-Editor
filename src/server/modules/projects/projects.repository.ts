export type ProjectVisibility = "private" | "workspace" | "public";

export type Project = {
	id: number;
	workspace_id: number;
	owner_id: number;
	title: string;
	description: string | null;
	visibility: ProjectVisibility;
	forked_from_id: number | null;
	created_at: Date;
	updated_at: Date;
	archived_at: Date | null;
};
const PROJECT_COLUMNS = `
  id, workspace_id, owner_id, title, description, visibility,
  forked_from_id, created_at, updated_at, archived_at
`;
