import { ForbiddenError, NotFoundError } from "../../lib/errors";
import { findMemberRole as findWorkspaceMemberRole } from "../workspaces/workspaces.repository";
import {
	createProject as createProjectRepo,
	findProjectById,
	findProjectMemberRole,
	listProjectsForUser,
	type Project,
} from "./projects.repository";
import type { CreateProjectInput } from "./projects.schemas";

const ensureProjectAccess = async (
	projectId: number,
	userId: number,
): Promise<{ project: Project; effectiveRole: string }> => {
	const project = await findProjectById(projectId);
	if (!project) throw new NotFoundError("Project not found");

	if (project.owner_id === userId) {
		return { project, effectiveRole: "owner" };
	}

	const memberRole = await findProjectMemberRole(projectId, userId);
	if (memberRole) {
		return { project, effectiveRole: memberRole };
	}
	if (project.visibility === "public") {
		return { project, effectiveRole: "public" };
	}
	if (project.visibility === "workspace") {
		const workspaceMemberRole = await findWorkspaceMemberRole(
			project.workspace_id,
			userId,
		);
		if (workspaceMemberRole) return { project, effectiveRole: "workspace" };
	}
	throw new ForbiddenError("You do not have access to this repository");
};

const ensureWrite = async (
	projectId: number,
	userId: number,
): Promise<Project> => {
	const { project, effectiveRole } = await ensureProjectAccess(
		projectId,
		userId,
	);
	if (!["owner", "editor"].includes(effectiveRole))
		throw new ForbiddenError("You do not have permission to edit this project");
	return project;
};

export const createProject = async (
	input: CreateProjectInput,
	userId: number,
): Promise<Project> => {
	const workspaceRole = await findWorkspaceMemberRole(
		input.workspaceId,
		userId,
	);
	if (!workspaceRole) {
		throw new ForbiddenError("You are not a member of this workspace");
	}
	return createProjectRepo({
		workspaceId: input.workspaceId,
		ownerId: userId,
		title: input.title,
		description: input.description ?? null,
		visibility: input.visibility,
	});
};

export const listProjects = async (
	userId: number,
	workspaceId: number,
): Promise<Project[]> => {
	return listProjectsForUser(userId, workspaceId);
};

export const getProjectInformation = async (
	userId: number,
	projectId: number,
): Promise<Project & { effectiveRole: string }> => {
	const { project, effectiveRole } = await ensureProjectAccess(
		projectId,
		userId,
	);
	return { ...project, effectiveRole };
};
