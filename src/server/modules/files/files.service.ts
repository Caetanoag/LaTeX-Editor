import { ConflictError, ForbiddenError, NotFoundError } from "../../lib/errors";
import { ensureProjectAccess } from "../projects/projects.service";
import {
	createFile as createFileRepo,
	findFileById,
	findFileByPath,
	listProjectFiles,
	type ProjectFile,
	type ProjectFileMeta,
} from "./files.repository";
import type { CreateFileInput } from "./files.schemas";

const ROLE_READ = [
	"owner",
	"editor",
	"commenter",
	"reader",
	"public",
	"workspace",
];
const ROLE_WRITE = ["owner", "editor"];
const ROLE_MANAGE = ["owner"];

const ensureFileAcess = async (
	fileId: number,
	userId: number,
): Promise<{ file: ProjectFile; role: string }> => {
	const file = await findFileById(fileId);
	if (!file) throw new NotFoundError("File not found");
	const role = await ensureProjectAccess(file.project_id, userId);
	if (!ROLE_READ.includes(role.effectiveRole)) {
		throw new ForbiddenError("You do not have acess to this error");
	}
	return { file: file, role: role.effectiveRole };
};

const ensureFileWrite = async (
	fileId: number,
	userId: number,
): Promise<ProjectFile> => {
	const { file, role } = await ensureFileAcess(fileId, userId);
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
const ensureProjectManage = async (
	projectId: number,
	userId: number,
): Promise<void> => {
	const { effectiveRole } = await ensureProjectAccess(projectId, userId);
	if (!ROLE_MANAGE.includes(effectiveRole)) {
		throw new ForbiddenError("Only the project owner can perform this action");
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
	const { file } = await ensureFileAcess(fileId, userId);
	return file;
};
