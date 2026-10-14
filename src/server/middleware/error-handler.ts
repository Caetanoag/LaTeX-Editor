import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AuthError } from "../modules/auth/auth.service";

export const errorHandler = (
	err: unknown,
	_req: Request,
	res: Response,
	_next: NextFunction,
): void => {
	if (err instanceof AuthError) {
		res.status(err.status).json({ error: err.code, message: err.message });
		return;
	}

	if (err instanceof ZodError) {
		res.status(400).json({
			error: "validation_error",
			message: "Invalid request data",
			details: err.issues,
		});
		return;
	}

	console.error("Unhandled error", err);
	res.status(500).json({
		error: "internal_error",
		message: "Internal server error",
	});
};
