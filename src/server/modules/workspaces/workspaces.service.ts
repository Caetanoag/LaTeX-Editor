import { ForbiddenError, NotFoundError } from "../../lib/errors";
import {
	findMemberRole,
	findWorkspaceById,
	findWorkspaceByUrlIdentifier,
	type Workspace,
} from "./workspaces.repository";

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
