import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth";
import { compileFile } from "./compile.service";

const router = Router();
router.use(requireAuth);

router.post("/files/:id/compile", async (req, res) => {
	const fileId = Number(req.params.id);
	const { result, projectTitle } = await compileFile(fileId, req.user!.id);
	if (result.status === "timeout") {
		res.status(504).json({
			error: "compile_timeout",
			message: `Compilation exceeded ${process.env.COMPILE_TIMEOUT_MS ?? 15000}ms`,
			durationMs: result.durationMs,
		});
		return;
	}
	if (result.status === "error") {
		res.status(422).json({
			error: "compile_error",
			message: "LaTeX compilation failed",
			log: result.log,
			durationMs: result.durationMs,
		});
		return;
	}
	const safeName = projectTitle.replace(/[^a-zA-Z0-9-_]/g, "_") || "document";
	res.setHeader("Content-Type", "application/pdf");
	res.setHeader("Content-Disposition", `inline; filename="${safeName}.pdf"`);
	res.setHeader("X-Compile-Duration-Ms", String(result.durationMs));
	res.send(result.pdf);
});
export default router;
