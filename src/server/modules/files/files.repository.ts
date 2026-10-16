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
