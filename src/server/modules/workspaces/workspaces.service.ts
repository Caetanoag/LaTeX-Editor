import { ForbiddenError, NotFoundError } from "../../lib/errors";
import {
	createWorkspace as createWorkspaceRepo,
	findMemberRole,
	findWorkspaceById,
	findWorkspaceByUrlIdentifier,
	listWorkspacesForUser,
	type Workspace,
	type WorkspaceWithRole,
} from "./workspaces.repository";
import type { CreateWorkspaceInput } from "./workspaces.schemas";

const slugify = (name: string): string => {
	const slug = name
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "") // remove diacríticos
		.replace(/[^a-z0-9]+/g, "-") // troca não-alfanuméricos por hífen
		.replace(/^-+|-+$/g, "") // remove hífens nas pontas
		.slice(0, 50);

	return slug || "workspace";
};

const generateUniqueUrlIdentifier = async (name: string): Promise<string> => {
	const baseSlug = slugify(name);

	let candidate = baseSlug;
	let number = 1;

	while (await findWorkspaceByUrlIdentifier(candidate)) {
		candidate = `${baseSlug}-${number++}`;
		if (number > 100) {
			return `base-slug-${Date.now()}`;
		}
	}
	return candidate;
};
const ensureMembership = async (
	workspaceId: number,
	userId: number,
): Promise<{ workspace: Workspace; role: string }> => {
	const workspace = await findWorkspaceById(workspaceId);
	if (!workspace) {
		throw new NotFoundError(`Workspace with id ${workspaceId} not found`);
	}

	const role = await findMemberRole(workspaceId, userId);
	if (!role) {
		throw new ForbiddenError(
			`User with id ${userId} is not a member of workspace with id ${workspaceId}`,
		);
	}
	return { workspace, role };
};

const ensureRole = async (
	workspaceId: number,
	userId: number,
	allowedRoles: string[],
): Promise<Workspace> => {
	const { workspace, role } = await ensureMembership(workspaceId, userId);

	if (!allowedRoles.includes(role)) {
		throw new ForbiddenError(
			`This action requires one of: ${allowedRoles.join(", ")}`,
		);
	}

	return workspace;
};

export const createWorkspace = async (
	input: CreateWorkspaceInput,
	userId: number,
): Promise<Workspace> => {
	const url = await generateUniqueUrlIdentifier(input.name);

	return createWorkspaceRepo({
		name: input.name,
		urlIdentifier: url,
		description: input.description,
		ownerId: userId,
	});
};

export const listWorkspaces = async (
	userId: number,
): Promise<WorkspaceWithRole[]> => {
	return listWorkspacesForUser(userId);
};

export const getWorkspace = async (
	workspaceId: number,
	userId: number,
): Promise<WorkspaceWithRole> => {
	const { workspace, role } = await ensureMembership(workspaceId, userId);
	return { ...workspace, role };
};
