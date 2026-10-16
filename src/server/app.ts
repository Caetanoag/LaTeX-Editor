import type { NextFunction, Request, Response } from "express";
import express from "express";
import { errorHandler } from "./middleware/error-handler";
import { authRouter } from "./modules/auth/auth.index";
import { filesRouter } from "./modules/files/files.index";
import { projectsRouter } from "./modules/projects/projects.index";
import { workspacesRouter } from "./modules/workspaces/workspaces.index";
export const app = express();
app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
	res.header("Access-Control-Allow-Origin", "*");
	res.header(
		"Access-Control-Allow-Methods",
		"GET, POST, PATCH, DELETE, OPTIONS",
	);
	res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
	if (req.method === "OPTIONS") {
		return res.sendStatus(204);
	}
	next();
});

app.use("/auth", authRouter);
app.use("/workspaces", workspacesRouter);
app.use("/projects", projectsRouter);
app.use("/", filesRouter);
app.use(errorHandler);
export default app;
