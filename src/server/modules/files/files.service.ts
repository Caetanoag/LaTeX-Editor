import { ForbiddenError, NotFoundError } from "../../lib/errors";
import { ensureProjectAccess } from "../projects/projects.service";
import { findFileById, type ProjectFile } from "./files.repository";

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
