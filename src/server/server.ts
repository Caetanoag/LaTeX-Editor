import type { Request, Response } from "express";
import app from "./app";

const port = process.env.PORT ?? 3000;

app.get("/", (req: Request, res: Response) => {
	res.send(`Hello, World! ${Date.now()}`);
});
app.get("/health", (req: Request, res: Response) => {
	res.send("OK");
});
app.listen(port, () => {
	console.log(`App running on port ${port}`);
});
