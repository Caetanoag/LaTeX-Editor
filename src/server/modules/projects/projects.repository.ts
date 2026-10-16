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

export const listProjectsForUser = async (
	userId: number,
	workspaceId?: number,
): Promise<Project[]> => {
	const params: number[] = [userId];

	let workspaceFilter = "";
	if (workspaceId !== undefined) {
		params.push(workspaceId);
		workspaceFilter = `and p.workspace_id = $${params.length}`;
	}

	const result = await pool.query<Project>(
		`
    select ${PROJECT_COLUMNS}
    from projects p
    where p.archived_at is null
      ${workspaceFilter}
      and (
        p.owner_id = $1
        or exists (
          select 1 from project_members pm
          where pm.project_id = p.id and pm.user_id = $1
        )
        or (
          p.visibility = 'workspace'
          and exists (
            select 1 from workspace_members wm
            where wm.workspace_id = p.workspace_id and wm.user_id = $1
          )
        )
        or p.visibility = 'public'
      )
    order by p.updated_at desc
    `,
		params,
	);
	return result.rows;
};

export const updateProject = async (
	id: number,
	input: {
		title?: string;
		description?: string | null;
		visibility?: ProjectVisibility;
	},
): Promise<Project> => {
	const fields: string[] = [];
	const values: (string | number | null)[] = [];
	let index = 1;

	if (input.title !== undefined) {
		fields.push(`title = $${index++}`);
		values.push(input.title);
	}
	if (input.description !== undefined) {
		fields.push(`description = $${index++}`);
		values.push(input.description);
	}
	if (input.visibility !== undefined) {
		fields.push(`visibility = $${index++}`);
		values.push(input.visibility);
	}
	if (fields.length === 0) return findProjectById(id);
	fields.push(`updated_at = now()`);
	values.push(id);
	const result = await pool.query<Project>(
		`
            updated projects
            set ${fields.join(", ")}
            where id = $${index}
            and archived_at is null
            returning ${PROJECT_COLUMNS}
        `,
		values,
	);
	return result.rows[0];
};

export const deleteProject = async (id: number): Promise<void> => {
	await pool.query(
		`
            updated projects
            set archived_at = now(), updated_at = now()
            where id = $1
            and archived_at is null
        `,
		[id],
	);
};
