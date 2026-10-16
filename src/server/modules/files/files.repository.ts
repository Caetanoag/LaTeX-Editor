import pool from "../../db/pool";
export type ProjectFile = {
	id: number;
	project_id: number;
	file_path: string;
	file_content: string;
	is_main: boolean;
	created_at: Date;
	updated_at: Date;
};
export type ProjectFileMeta = Omit<ProjectFile, "file_content">;

const FILE_COLUMNS = `
  id, project_id, file_path, file_content, is_main,
  created_at, updated_at
`;

const FILE_META_COLUMNS = `
  id, project_id, file_path, is_main,
  created_at, updated_at
`;

export const createFile = async (input: {
	projectId: number;
	filePath: number;
	fileContent: string;
	isMain: boolean;
}): Promise<ProjectFile> => {
	const result = await pool.query<ProjectFile>(
		`
		insert into project_files (project_id, file_path, file_content, is_main)
		values ($1, $2, $3, $4)
		returning ${FILE_COLUMNS}	
	`,
		[input.projectId, input.filePath, input.fileContent, input.isMain],
	);
	return result.rows[0];
};

export const listProjectFiles = async (
	projectId: number,
): Promise<ProjectFile[]> => {
	const result = await pool.query<ProjectFile>(
		`
			select ${FILE_META_COLUMNS} from project_files
			where project_id = $1
			order by file_path
		`,
		[projectId],
	);
	return result.rows;
};

export const findFileById = async (
	id: number,
): Promise<ProjectFile | undefined> => {
	const result = await pool.query<ProjectFile>(
		`
			select ${FILE_COLUMNS} from project_files
			where id = $1
		`,
		[id],
	);
	return result.rows[0];
};

export const findFileByPath = async (
	projectId: number,
	filePath: string,
): Promise<ProjectFile | undefined> => {
	const result = await pool.query<ProjectFile>(
		`
		select ${FILE_COLUMNS} from project_files
		where project_id = $1
		and file_path = $2	
	`,
		[projectId, filePath],
	);
	return result.rows[0];
};

export const listProjectFilesWithContent = async (
	projectId: number,
): Promise<ProjectFile[]> => {
	const result = await pool.query<ProjectFile>(
		`
			select ${FILE_COLUMNS} from project_files
			where project_id = $1
			order by file_path
		`,
		[projectId],
	);
	return result.rows;
};

export const updateFileContent = async (
	id: number,
	fileContent: string,
): Promise<ProjectFile> => {
	const result = await pool.query<ProjectFile>(
		`
		update project_files
		set file_content = $1, updated_at = now()
		where id = $2
		returning ${FILE_COLUMNS}	
	`,
		[fileContent, id],
	);
	return result.rows[0];
};

export const setMainFile = async (
	projectId: number,
	fileId: number,
): Promise<ProjectFile | undefined> => {
	const client = await pool.connect();
	try {
		await client.query("begin");

		await client.query(
			`
			update project_files
			set is_main = false, updated_at = now()
			where project_id = $1
			and is_main = true
		`,
			[projectId],
		);

		const result = await client.query<ProjectFile>(
			`
			update project_files
			set is_main = true, updated_at = now()
			where id = $1
			and project_id = $2
			returning ${FILE_COLUMNS}	
		`,
			[fileId, projectId],
		);
		await client.query("commit");
		return result.rows[0];
	} catch (error) {
		await client.query("rollback");
		throw error;
	} finally {
		await client.release();
	}
};

export const deleteFile = async (id: number): Promise<void> => {
	await pool.query("delete from file_projects where id = $1", [id]);
};
