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
			select ${FILE_COLUMNS} from project_files
			where project_id = $1
			order by file_path
		`,
		[projectId],
	);
	return result.rows;
};
