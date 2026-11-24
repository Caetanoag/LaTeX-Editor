import { Router } from "express";
import { z } from "zod";
import { UnauthorizedError } from "../../lib/errors";
import { requireAuth } from "../../middleware/require-auth";
import {
	createProjectSchema,
	listProjectsQuerySchema,
	putProjectTagsSchema,
	updateProjectSchema,
} from "./projects.schemas";
import {
	createProject,
	deleteProject,
	getProjectInformation,
	getProjectTagsForUser,
	listProjects,
	replaceProjectTagsForUser,
	restoreProject,
	updateProject,
} from "./projects.service";

const router = Router();
const projectIdParamSchema = z.coerce.number().int().positive();

const requireUserId = (userId: number | undefined): number => {
	if (userId === undefined) throw new UnauthorizedError();
	return userId;
};

router.use(requireAuth);

router.post("/", async (req, res) => {
	const input = createProjectSchema.parse(req.body);
	const userId = requireUserId(req.user?.id);
	const project = await createProject(input, userId);
	res.status(201).json({ project });
});

router.get("/", async (req, res) => {
	const { workspaceId, archived } = listProjectsQuerySchema.parse(req.query);
	const userId = requireUserId(req.user?.id);
	const projects = await listProjects(userId, workspaceId, archived);
	res.json({ projects });
});

router.get("/:id", async (req, res) => {
	const projectId = projectIdParamSchema.parse(req.params.id);
	const userId = requireUserId(req.user?.id);
	const project = await getProjectInformation(userId, projectId);
	res.json({ project });
});

router.get("/:id/tags", async (req, res) => {
	const projectId = projectIdParamSchema.parse(req.params.id);
	const userId = requireUserId(req.user?.id);
	const tags = await getProjectTagsForUser(projectId, userId);
	res.json({ tags });
});

router.put("/:id/tags", async (req, res) => {
	const projectId = projectIdParamSchema.parse(req.params.id);
	const input = putProjectTagsSchema.parse(req.body);
	const userId = requireUserId(req.user?.id);
	const tags = await replaceProjectTagsForUser(projectId, userId, input);
	res.json({ tags });
});

router.patch("/:id", async (req, res) => {
	const projectId = projectIdParamSchema.parse(req.params.id);
	const input = updateProjectSchema.parse(req.body);
	const userId = requireUserId(req.user?.id);
	const updated = await updateProject(userId, projectId, input);
	res.json({ updated });
});

router.delete("/:id", async (req, res) => {
	const projectId = projectIdParamSchema.parse(req.params.id);
	const userId = requireUserId(req.user?.id);
	await deleteProject(projectId, userId);
	res.status(204).end();
});

router.post("/:id/restore", async (req, res) => {
	const projectId = projectIdParamSchema.parse(req.params.id);
	const userId = requireUserId(req.user?.id);
	const project = await restoreProject(projectId, userId);
	res.json({ project });
});
export default router;
