import pool from "../../db/pool";

export type Workspace = {
	id: number;
	name: string;
	url_identifier: string;
	description: string | null;
	owner_id: number;
	created_at: Date;
	updated_at: Date;
	deleted_at: Date | null;
};

const WORKSPACE_COLUMNS = `
  id, name, url_identifier, description, owner_id,
  created_at, updated_at, deleted_at
`;

const getRoleId = async (
	scope: "workspace" | "project",
	name: string,
): Promise<number> => {
	const result = await pool.query(
		`
           select id from roles where scope = $1 and name = $2
        `,
		[scope, name],
	);
	return result.rows[0]?.id;
};
export const createWorkspace = async (input: {
	name: string;
	urlIdentifier: string;
	description?: string;
	ownerId: number;
}): Promise<Workspace> => {
	const roleId = await getRoleId("workspace", "owner");
	if (!roleId) throw new Error("Role 'onwner' not found for scope 'workspace'");
	const client = await pool.connect();
	try {
		await client.query("begin");
		const result = await client.query(
			`
                insert into workspaces (name, url_identifier, description, owner_id)
                values ($1, $2, $3, $4)
                returning ${WORKSPACE_COLUMNS}
            `,
			[input.name, input.urlIdentifier, input.description, input.ownerId],
		);
		const workspace = result.rows[0] as Workspace;
		await client.query(
			"insert into workspace_members (workspace_id, user_id, role_id) values ($1, $2, $3)",
			[workspace.id, input.ownerId, roleId],
		);
		await client.query("commit");
		return workspace;
	} catch (err) {
		await client.query("rollback");
		throw err;
	} finally {
		client.release();
	}
};

export const findWorkspaceById = async (
	id: number,
): Promise<Workspace | null> => {
	const result = await pool.query<Workspace>(
		`select ${WORKSPACE_COLUMNS} from workspaces where id = $1`,
		[id],
	);
	return result.rows[0] as Workspace | null;
};

export const findWorkspaceByUrlIdentifier = async (
	urlIdentifier: string,
): Promise<Workspace | null> => {
	const result = await pool.query<Workspace>(
		`select ${WORKSPACE_COLUMNS} from workspaces where url_identifier = $1`,
		[urlIdentifier],
	);
	return result.rows[0] as Workspace | null;
};

export type WorkspaceWithRole = Workspace & { role: string };

export const listWorkspacesForUser = async (
	userId: number,
): Promise<WorkspaceWithRole[]> => {
	const result = await pool.query<WorkspaceWithRole>(
		`
            select ${WORKSPACE_COLUMNS.split(",")
							.map((c) => `w.${c.trim()}`)
							.join(", ")}, r.name as role
            from workspaces w
            join workspace_members wm on w.id = wm.workspace_id
            join roles r on wm.role_id = r.id
            where wm.user_id = $1
        `,
		[userId],
	);
	return result.rows as WorkspaceWithRole[];
};

export const updateWorkspace = async (
	id: number,
	input: { name?: string; description?: string | null },
): Promise<Workspace | undefined> => {
	const fields: string[] = [];
	const values: (number | string | null)[] = [];
	let index = 1;

	if (input.name !== undefined) {
		fields.push(`name = $${index++}`);
		values.push(input.name);
	}
	if (input.description !== undefined) {
		fields.push(`description = $${index++}`);
		values.push(input.description);
	}
	if (fields.length === 0) {
		return (await findWorkspaceById(id)) as Workspace;
	}
	fields.push(`updated_at = now()`);
	values.push(id);

	const result = await pool.query(
		`
            update workspaces
            set ${fields.join(", ")}
            where id = $${index}
            and deleted_at is null
            returning ${WORKSPACE_COLUMNS}
        `,
		values,
	);
	if (!result.rows[0]) {
		throw new Error("Workspace does not exist or is deleted");
	}
	return result.rows[0];
};

export const deleteWorkspace = async (id: number): Promise<void> => {
	await pool.query(
		`
            update workspaces
            set deleted_at = now(), updated_at = now()
            where id = $1
                and delted_at is null
        `,
		[id],
	);
};
