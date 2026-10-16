import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth";
import { createFileSchema, updateFileSchema } from "./files.schemas";
import {
	createFile,
	deleteFile,
	getFile,
	listFiles,
	markAsMain,
	updateFile,
} from "./files.service";

const router = Router();
router.use(requireAuth);

router.post("/projects/:projectId/files", async (req, res) => {
	const projectId = Number(req.params.projectId);
	const projectInput = createFileSchema.parse(req.body);
	const file = await createFile(projectId, req.user!.id, projectInput);
	res.status(201).json({ file });
});

router.get("/projects/:projectId/files", async (req, res) => {
	const projectId = Number(req.params.projectId);
	const files = await listFiles(projectId, req.user!.id);
	res.json({ files });
});

router.get("/files/:id", async (req, res) => {
	const fileId = Number(req.params.id);
	const file = await getFile(fileId, req.user!.id);
	res.json({ file });
});
router.put("/files/:id", async (req, res) => {
	const fileId = Number(req.params.id);
	const input = updateFileSchema.parse(req.body);
	const file = await updateFile(fileId, req.user!.id, input);
	res.json({ file });
});
router.patch("/files/:id/main", async (req, res) => {
	const fileId = Number(req.params.id);
	const file = await markAsMain(fileId, req.user!.id);
	res.json({ file });
});
router.delete("/files/:id", async (req, res) => {
	const fileId = Number(req.params.id);
	await deleteFile(fileId, req.user!.id);
	res.status(204).end();
});

export default router;
