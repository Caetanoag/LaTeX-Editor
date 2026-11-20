import { type Request, type Response, Router } from "express";
import { requireAuth } from "../../middleware/require-auth";
import { userIdParamSchema } from "./users.schemas";
import { getUserById } from "./users.service";

const router: Router = Router();

router.use(requireAuth);

router.get("/:id", async (req: Request, res: Response) => {
	const { id } = userIdParamSchema.parse(req.params);
	const user = await getUserById(id);
	res.json({ user });
});

export default router;
