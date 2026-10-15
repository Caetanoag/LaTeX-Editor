import pool from "../../db/pool";
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

export const findProjectMemberRole = async (
	projectId: number,
	memberId: number,
): Promise<string | undefined> => {
	const result = await pool.query<{ role: string }>(
		`
        select r.name as role
        from project_members pm
        join roles r on r.id = pm.role_id
        where pm.project_id = $1
        and pm.user_id = $2
        `,
		[projectId, memberId],
	);
	return result.rows[0]?.role;
};
