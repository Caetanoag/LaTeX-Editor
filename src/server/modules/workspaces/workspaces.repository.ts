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
	owenerId: number;
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
			[input.name, input.urlIdentifier, input.description, input.owenerId],
		);
		const workspace = result.rows[0] as Workspace;
		await client.query(
			"insert into workspace_members (workspace_id, user_id, role_id) values ($1, $2, $3)",
			[workspace.id, input.owenerId, roleId],
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
