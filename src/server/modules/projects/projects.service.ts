import {
	ForbiddenError,
	NotFoundError,
	ValidationError,
} from "../../lib/errors";
import { findMemberRole as findWorkspaceMemberRole } from "../workspaces/workspaces.repository";
import {
	deleteProject as archiveProjectRepo,
	createProject as createProjectRepo,
	findArchivedProjectById,
	findProjectById,
	findProjectMemberRole,
	getProjectTags,
	getTagsByProjectIds,
	listProjectsForUser,
	type Project,
	type ProjectWithTags,
	replaceProjectTags,
	restoreProject as restoreProjectRepo,
	type Tag,
	updateProject as updatedProjectRepo,
} from "./projects.repository";
import type {
	CreateProjectInput,
	PutProjectTagsInput,
	UpdateProjectInput,
} from "./projects.schemas";

export const ensureProjectAccess = async (
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

const attachTags = async (project: Project): Promise<ProjectWithTags> => {
	const tags = await getProjectTags(project.id);
	return { ...project, tags };
};

export const createProject = async (
	input: CreateProjectInput,
	userId: number,
): Promise<ProjectWithTags> => {
	const workspaceRole = await findWorkspaceMemberRole(
		input.workspaceId,
		userId,
	);
	if (!workspaceRole) {
		throw new ForbiddenError("You are not a member of this workspace");
	}
	const project = await createProjectRepo({
		workspaceId: input.workspaceId,
		ownerId: userId,
		title: input.title,
		description: input.description ?? null,
		visibility: input.visibility,
	});
	return { ...project, tags: [] };
};

export const listProjects = async (
	userId: number,
	workspaceId: number | undefined,
	archived = false,
): Promise<ProjectWithTags[]> => {
	const projects = await listProjectsForUser(userId, workspaceId, archived);
	const tagsByProject = await getTagsByProjectIds(projects.map((p) => p.id));
	return projects.map((project) => ({
		...project,
		tags: tagsByProject.get(String(project.id)) ?? [],
	}));
};

export const getProjectInformation = async (
	userId: number,
	projectId: number,
): Promise<ProjectWithTags & { effectiveRole: string }> => {
	const { project, effectiveRole } = await ensureProjectAccess(
		projectId,
		userId,
	);
	const tags = await getProjectTags(project.id);
	return { ...project, effectiveRole, tags };
};

export const updateProject = async (
	userId: number,
	projectId: number,
	input: UpdateProjectInput,
): Promise<ProjectWithTags> => {
	await ensureWrite(projectId, userId);

	const updated = await updatedProjectRepo(projectId, {
		title: input.title,
		description: input.description,
		visibility: input.visibility,
	});
	if (!updated) throw new NotFoundError("Project not found");
	return attachTags(updated);
};

export const deleteProject = async (
	projectId: number,
	userId: number,
): Promise<void> => {
	const { project } = await ensureProjectAccess(projectId, userId);
	if (project.owner_id !== userId) {
		throw new ForbiddenError("Only the owner can delete this project");
	}
	await archiveProjectRepo(projectId);
};

export const restoreProject = async (
	projectId: number,
	userId: number,
): Promise<ProjectWithTags> => {
	const project = await findArchivedProjectById(projectId);
	if (!project) throw new NotFoundError("Archived project not found");
	if (project.owner_id !== userId) {
		throw new ForbiddenError("Only the owner can restore this project");
	}

	const restored = await restoreProjectRepo(projectId);
	if (!restored) throw new NotFoundError("Archived project not found");
	return attachTags(restored);
};

export const getProjectTagsForUser = async (
	projectId: number,
	userId: number,
): Promise<Tag[]> => {
	await ensureProjectAccess(projectId, userId);
	return getProjectTags(projectId);
};

export const replaceProjectTagsForUser = async (
	projectId: number,
	userId: number,
	input: PutProjectTagsInput,
): Promise<Tag[]> => {
	const titles = input.tags.map((t) => t.title.trim());
	const seen = new Set<string>();
	for (const title of titles) {
		const key = title.toLowerCase();
		if (seen.has(key)) {
			throw new ValidationError([
				{
					code: "custom",
					message: "Duplicate tag titles are not allowed",
					path: ["tags"],
				},
			]);
		}
		seen.add(key);
	}

	await ensureWrite(projectId, userId);
	const tags = await replaceProjectTags(projectId, userId, titles);
	if (tags === null) throw new NotFoundError("Project not found");
	return tags;
};
