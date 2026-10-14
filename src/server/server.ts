import type { Request, Response } from "express";
import app from "./app";
import { cleanExpiredSessions } from "./modules/auth/auth.repository";

const port = process.env.PORT ?? 3000;
const SESSION_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

const cleanupExpiredSessions = async (): Promise<void> => {
	try {
		const deleted = await cleanExpiredSessions();
		if (deleted > 0) {
			console.log(`Cleaned up ${deleted} expired session(s)`);
		}
	} catch (err) {
		console.error("Failed to clean up expired sessions", err);
	}
};

app.get("/", (req: Request, res: Response) => {
	res.send(`Hello, World! ${Date.now()}`);
});
app.get("/health", (req: Request, res: Response) => {
	res.send("OK");
});
app.listen(port, () => {
	console.log(`App running on port ${port}`);
	void cleanupExpiredSessions();
	setInterval(() => void cleanupExpiredSessions(), SESSION_CLEANUP_INTERVAL_MS);
});
