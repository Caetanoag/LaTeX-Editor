import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth";
import { deleteProject } from "./projects.repository";
import {
	createProjectSchema,
	listProjectsQuerySchema,
	updateProjectSchema,
} from "./projects.schemas";
import {
	createProject,
	getProjectInformation,
	listProjects,
	updateProject,
} from "./projects.service";

const router = Router();

router.use(requireAuth);

router.post("/", async (req, res) => {
	const input = createProjectSchema.parse(req.body);
	const project = await createProject(input, req.user!.id);
	res.status(201).json({ project });
});

router.get("/", async (req, res) => {
	const { workspaceId } = listProjectsQuerySchema.parse(req.query);
	const projects = await listProjects(req.user!.id, workspaceId);
	res.json({ projects });
});

router.get("/:id", async (req, res) => {
	const projectId = Number(req.params.id);
	const project = await getProjectInformation(req.user!.id, projectId);
	res.json({ project });
});

router.patch("/:id", async (req, res) => {
	const projectId = Number(req.params.id);
	const input = updateProjectSchema.parse(req.body);
	const updated = await updateProject(req.user!.id, projectId, input);
	res.json({ updated });
});

router.delete("/:id", async (req, res) => {
	const projectId = Number(req.params.id);
	await deleteProject(projectId, req.user!.id);
	res.status(204).end();
});
export default router;
