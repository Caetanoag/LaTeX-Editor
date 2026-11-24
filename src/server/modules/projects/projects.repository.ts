import pool from "../../db/pool";
import { ForbiddenError } from "../../lib/errors";
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

export type Tag = {
	id: number;
	title: string;
	description: string;
};

export type ProjectWithTags = Project & { tags: Tag[] };
const PROJECT_COLUMNS = `
  id, workspace_id, owner_id, title, description, visibility,
  forked_from_id, created_at, updated_at, archived_at
`;
const DEFAULT_MAIN_FILE_PATH = "/main.tex";
const DEFAULT_MAIN_FILE_CONTENT = `\\documentclass{article}

\\begin{document}
\tHello, world!
\\end{document}
`;

export const findProjectMemberRole = async (
	projectId: number,
	userId: number,
): Promise<string | undefined> => {
	const result = await pool.query<{ role: string }>(
		`
        select r.name as role
        from project_members pm
        join roles r on r.id = pm.role_id
        where pm.project_id = $1
        and pm.user_id = $2
        `,
		[projectId, userId],
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
            select id from roles where scope = 'project' and name = 'owner'
        `,
	);
	const ownerRoleId = ownerRole.rows[0]?.id;

	if (!ownerRoleId) throw new Error("Role owner (project) not found");

	const client = await pool.connect();
	try {
		await client.query("begin");
		const projectResult = await client.query<Project>(
			`
                insert into projects (workspace_id, owner_id, title, description, visibility)
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

		await client.query(
			`
            insert into project_files (project_id, file_path, file_content, is_main)
            values ($1, $2, $3, true)
            `,
			[project.id, DEFAULT_MAIN_FILE_PATH, DEFAULT_MAIN_FILE_CONTENT],
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

export const findProjectById = async (
	id: number,
): Promise<Project | undefined> => {
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
	archived = false,
): Promise<Project[]> => {
	const params: number[] = [userId];

	let workspaceFilter = "";
	if (workspaceId !== undefined) {
		params.push(workspaceId);
		workspaceFilter = `and p.workspace_id = $${params.length}`;
	}

	const archivedFilter = archived
		? "p.archived_at is not null"
		: "p.archived_at is null";

	const result = await pool.query<Project>(
		`
    select ${PROJECT_COLUMNS}
    from projects p
    where ${archivedFilter}
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
): Promise<Project | undefined> => {
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
            update projects
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
            update projects
            set archived_at = now(), updated_at = now()
            where id = $1
            and archived_at is null
        `,
		[id],
	);
};

export const findArchivedProjectById = async (
	id: number,
): Promise<Project | undefined> => {
	const result = await pool.query<Project>(
		`
            select ${PROJECT_COLUMNS} from projects
            where id = $1
            and archived_at is not null
        `,
		[id],
	);
	return result.rows[0];
};

export const restoreProject = async (
	id: number,
): Promise<Project | undefined> => {
	const result = await pool.query<Project>(
		`
            update projects
            set archived_at = null, updated_at = now()
            where id = $1
            and archived_at is not null
            returning ${PROJECT_COLUMNS}
        `,
		[id],
	);
	return result.rows[0];
};

export const getProjectTags = async (projectId: number): Promise<Tag[]> => {
	const result = await pool.query<Tag>(
		`
            select t.id, t.title, t.description
            from project_tags pt
            join tags t on t.id = pt.tag_id
            where pt.project_id = $1
            order by t.title asc
        `,
		[projectId],
	);
	return result.rows;
};

export const getTagsByProjectIds = async (
	projectIds: number[],
): Promise<Map<string, Tag[]>> => {
	const map = new Map<string, Tag[]>();
	for (const id of projectIds) map.set(String(id), []);
	if (projectIds.length === 0) return map;

	const result = await pool.query<Tag & { project_id: number | string }>(
		`
            select pt.project_id, t.id, t.title, t.description
            from project_tags pt
            join tags t on t.id = pt.tag_id
            where pt.project_id = any($1::bigint[])
            order by t.title asc
        `,
		[projectIds],
	);
	for (const row of result.rows) {
		const key = String(row.project_id);
		const tags = map.get(key);
		const tag: Tag = {
			id: row.id,
			title: row.title,
			description: row.description,
		};
		if (tags) tags.push(tag);
		else map.set(key, [tag]);
	}
	return map;
};

export const replaceProjectTags = async (
	projectId: number,
	userId: number,
	titles: string[],
): Promise<Tag[] | null> => {
	const client = await pool.connect();
	try {
		await client.query("begin");

		const lock = await client.query<Project>(
			`select ${PROJECT_COLUMNS} from projects where id = $1 and archived_at is null for update`,
			[projectId],
		);
		const project = lock.rows[0];
		if (!project) {
			await client.query("rollback");
			return null;
		}

		if (project.owner_id !== userId) {
			const roleResult = await client.query<{ role: string }>(
				`
                select r.name as role
                from project_members pm
                join roles r on r.id = pm.role_id
                where pm.project_id = $1
                and pm.user_id = $2
                `,
				[projectId, userId],
			);
			const role = roleResult.rows[0]?.role;
			if (!role || !["owner", "editor"].includes(role)) {
				await client.query("rollback");
				throw new ForbiddenError(
					"You do not have permission to edit this project",
				);
			}
		}

		const tagIds: number[] = [];
		for (const title of titles) {
			const upsert = await client.query<Tag>(
				`
                    insert into tags (title, description)
                    values ($1, '')
                    on conflict (title) do update set title = tags.title
                    returning id, title, description
                `,
				[title],
			);
			tagIds.push(upsert.rows[0].id);
		}

		await client.query(`delete from project_tags where project_id = $1`, [
			projectId,
		]);
		if (tagIds.length > 0) {
			await client.query(
				`
                    insert into project_tags (project_id, tag_id)
                    select $1, unnest($2::bigint[])
                    on conflict do nothing
                `,
				[projectId, tagIds],
			);
		}

		await client.query(`update projects set updated_at = now() where id = $1`, [
			projectId,
		]);

		const tagsResult = await client.query<Tag>(
			`
                select t.id, t.title, t.description
                from project_tags pt
                join tags t on t.id = pt.tag_id
                where pt.project_id = $1
                order by t.title asc
            `,
			[projectId],
		);

		await client.query("commit");
		return tagsResult.rows;
	} catch (error) {
		await client.query("rollback");
		throw error;
	} finally {
		client.release();
	}
};
