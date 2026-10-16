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
