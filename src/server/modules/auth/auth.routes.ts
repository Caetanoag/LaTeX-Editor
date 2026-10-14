import { Router } from "express";
import { getBearerToken, requireAuth } from "../../middleware/require-auth";
import { loginSchema, registerSchema } from "./auth.schemas";
import { login, logout, register } from "./auth.service";

const router = Router();

router.post("/register", async (req, res) => {
	const input = registerSchema.parse(req.body);
	const { user, session } = await register(input);
	res.status(201).json({ user, session });
});

router.post("/login", async (req, res) => {
	const input = loginSchema.parse(req.body);
	const { user, session } = await login(input);
	res.json({ user, session });
});

router.post("/logout", async (req, res) => {
	const token = getBearerToken(req);
	if (token) await logout(token);
	res.sendStatus(204);
});

router.get("/me", requireAuth, (req, res) => {
	res.json({ user: req.user });
});

export default router;
