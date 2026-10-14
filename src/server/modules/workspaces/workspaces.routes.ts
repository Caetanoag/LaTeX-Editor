import { type Request, type Response, Router } from "express";
import {
	createWorkspaceSchema,
	updateWorkspaceSchema,
} from "./workspaces.schemas";
import {
	createWorkspace,
	deleteWorkspace,
	getWorkspace,
	listWorkspaces,
	updateWorkspace,
} from "./workspaces.service";

const router: Router = Router();

router.post("/", async (req: Request, res: Response) => {
	const input = createWorkspaceSchema.parse(req.body);
	const workspace = await createWorkspace(input, req.user!.id);
	res.status(201).json({ workspace });
});

router.get("/", async (req: Request, res: Response) => {
	const workspaces = await listWorkspaces(req.user!.id);
	res.json({ workspaces });
});

router.get("/:id", async (req: Request, res: Response) => {
	const workspaceId = Number(req.params.id);
	const workspace = await getWorkspace(workspaceId, req.user!.id);
	res.json({ workspace });
});

router.patch("/:id", async (req: Request, res: Response) => {
	const workspaceId = Number(req.params.id);
	const input = updateWorkspaceSchema.parse(req.body);
	const workspace = await updateWorkspace(workspaceId, req.user!.id, input);
	res.json({ workspace });
});

router.delete("/:id", async (req: Request, res: Response) => {
	const workspaceId = Number(req.params.id);
	await deleteWorkspace(workspaceId, req.user!.id);
	res.status(204).end();
});
export default router;
