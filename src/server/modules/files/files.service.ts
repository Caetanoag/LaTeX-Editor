import { ConflictError, ForbiddenError, NotFoundError } from "../../lib/errors";
import { ensureProjectAccess } from "../projects/projects.service";
import {
	createFile as createFileRepo,
	deleteFile as deleteFileRepo,
	findFileById,
	findFileByPath,
	listProjectFiles,
	listProjectFilesWithContent as listProjectFilesWithContentRepo,
	type ProjectFile,
	type ProjectFileMeta,
	setMainFile,
	updateFileContent,
} from "./files.repository";
import type { CreateFileInput, UpdateFileInput } from "./files.schemas";

const ROLE_READ = [
	"owner",
	"editor",
	"commenter",
	"reader",
	"public",
	"workspace",
];
const ROLE_WRITE = ["owner", "editor"];

const ensureFileAccess = async (
	fileId: number,
	userId: number,
): Promise<{ file: ProjectFile; role: string }> => {
	const file = await findFileById(fileId);
	if (!file) throw new NotFoundError("File not found");
	const role = await ensureProjectAccess(file.project_id, userId);
	if (!ROLE_READ.includes(role.effectiveRole)) {
		throw new ForbiddenError("You do not have acess to this file");
	}
	return { file: file, role: role.effectiveRole };
};

const ensureFileWrite = async (
	fileId: number,
	userId: number,
): Promise<ProjectFile> => {
	const { file, role } = await ensureFileAccess(fileId, userId);
	if (!ROLE_WRITE.includes(role)) {
		throw new ForbiddenError("You do not have permission to edit this file");
	}
	return file;
};
const ensureProjectWrite = async (
	projectId: number,
	userId: number,
): Promise<void> => {
	const { effectiveRole } = await ensureProjectAccess(projectId, userId);
	if (!ROLE_WRITE.includes(effectiveRole)) {
		throw new ForbiddenError("You do not have access to write to this project");
	}
};

export const createFile = async (
	projectId: number,
	userId: number,
	input: CreateFileInput,
): Promise<ProjectFile> => {
	await ensureProjectWrite(projectId, userId);

	const existing = await findFileByPath(projectId, input.filePath);
	if (existing) throw new ConflictError("A file with this path already exists");
	return createFileRepo({
		projectId: projectId,
		filePath: input.filePath,
		fileContent: input.fileContent,
		isMain: input.isMain,
	});
};

export const listFiles = async (
	projectId: number,
	userId: number,
): Promise<ProjectFileMeta[]> => {
	await ensureProjectAccess(projectId, userId);
	return await listProjectFiles(projectId);
};
export const getFile = async (
	fileId: number,
	userId: number,
): Promise<ProjectFile> => {
	const { file } = await ensureFileAccess(fileId, userId);
	return file;
};

export const updateFile = async (
	fileId: number,
	userId: number,
	input: UpdateFileInput,
): Promise<ProjectFile> => {
	await ensureFileWrite(fileId, userId);
	const updated = await updateFileContent(fileId, input.fileContent);
	if (!updated) throw new NotFoundError("File not found");
	return updated;
};

export const deleteFile = async (
	fileId: number,
	userId: number,
): Promise<void> => {
	const file = await ensureFileWrite(fileId, userId);
	if (file.is_main) {
		const files = await listFiles(file.project_id, userId);
		if (files.length <= 1) {
			throw new ConflictError("Cannot delete the only file of the project");
		}
	}
	await deleteFileRepo(fileId);
};

export const markAsMain = async (
	fileId: number,
	userId: number,
): Promise<ProjectFile> => {
	const file = await ensureFileWrite(fileId, userId);
	if (file.is_main) return file;

	const updated = await setMainFile(file.project_id, fileId);
	if (!updated) throw new NotFoundError("File not found");
	return updated;
};

export const listProjectFilesWithContent = async (
	projectId: number,
	userId: number,
): Promise<ProjectFile[]> => {
	await ensureProjectAccess(projectId, userId);
	return listProjectFilesWithContentRepo(projectId);
};
