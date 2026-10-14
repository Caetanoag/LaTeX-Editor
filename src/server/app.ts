import type { NextFunction, Request, Response } from "express";
import express from "express";
import { errorHandler } from "./middleware/error-handler";
import { authRouter } from "./modules/auth/auth.index";
export const app = express();
app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
	res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
	if (req.method === "OPTIONS") {
		return res.sendStatus(204);
	}
	next();
});

app.use("/auth", authRouter);

app.use(errorHandler);
export default app;
