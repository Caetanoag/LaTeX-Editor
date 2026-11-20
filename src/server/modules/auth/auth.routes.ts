import { type Request, Router } from "express";
import { UnauthorizedError } from "../../lib/errors";
import { getBearerToken, requireAuth } from "../../middleware/require-auth";
import {
	deleteAccountSchema,
	loginSchema,
	registerSchema,
	sessionIdParamSchema,
} from "./auth.schemas";
import {
	deleteAccount,
	listAccountSessions,
	login,
	logout,
	logoutAllSessions,
	register,
	revokeAccountSession,
} from "./auth.service";

const router = Router();

const requireSession = (req: Request): { userId: number; token: string } => {
	const userId = req.user?.id;
	const token = req.sessionToken;
	if (userId === undefined || !token) {
		throw new UnauthorizedError("Authentication required");
	}
	return { userId, token };
};

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

router.get("/sessions", requireAuth, async (req, res) => {
	const { userId, token } = requireSession(req);
	const sessions = await listAccountSessions(userId, token);
	res.json({ sessions });
});

router.delete("/sessions/:id", requireAuth, async (req, res) => {
	const { userId } = requireSession(req);
	const { id } = sessionIdParamSchema.parse(req.params);
	await revokeAccountSession(id, userId);
	res.sendStatus(204);
});

router.post("/logout-all", requireAuth, async (req, res) => {
	const { userId } = requireSession(req);
	await logoutAllSessions(userId);
	res.sendStatus(204);
});

router.delete("/account", requireAuth, async (req, res) => {
	const { userId } = requireSession(req);
	const input = deleteAccountSchema.parse(req.body);
	await deleteAccount(userId, input);
	res.sendStatus(204);
});

export default router;
