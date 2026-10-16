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

export const createProject = async (input: {
	workspaceId: number;
	ownerId: number;
	title: string;
	description: string | null;
	visibility: ProjectVisibility;
}): Promise<Project> => {
	const ownerRole = await pool.query<{ id: number }>(
		`
            select id from roles where scope = 'project' and name = 'owner',
        `,
	);
	const ownerRoleId = ownerRole.rows[0]?.id;

	if (!ownerRoleId) throw new Error("Role owner (project) not found");

	const client = await pool.connect();
	try {
		await client.query("begin");
		const projectResult = await client.query<Project>(
			`
                insert into projects (workspace_id, owner_id, title, description, visiblity)
                values ($1, $2, $3, $4, $5)
                returning ${PROJECT_COLUMNS}
            `,
			[
				input.workspaceId,
				input.ownerId,
				input.title,
				input.description,
				input.visibility,
			],
		);
		const project = projectResult.rows[0];

		await client.query(
			`
            insert into project_members (project_id, user_id, role_id, granted_by)
            values ($1, $2, $3, $4)
            `,

			[project.id, input.ownerId, ownerRoleId, input.ownerId],
		);
		await client.query("commit");
		return project;
	} catch (error) {
		await client.query("rollback");
		throw error;
	} finally {
		client.release();
	}
};

export const findProjectById = async (id: number): Promise<Project> => {
	const result = await pool.query<Project>(
		`
            select ${PROJECT_COLUMNS} from projects
            where id = $1
            and archived_at is null
        `,
		[id],
	);
	return result.rows[0];
};
