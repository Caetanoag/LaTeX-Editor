import { ForbiddenError, NotFoundError } from "../../lib/errors";
import { findMemberRole as findWorkspaceMemberRole } from "../workspaces/workspaces.repository";
import {
	findProjectById,
	findProjectMemberRole,
	type Project,
} from "./projects.repository";

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
