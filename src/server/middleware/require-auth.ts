import type { NextFunction, Request, Response } from "express";
import { AuthError, getCurrentUser } from "../modules/auth/auth.service";

const BEARER_PREFIX = "Bearer ";

export const getBearerToken = (req: Request): string | undefined => {
	const header = req.header("authorization");
	if (!header || !header.startsWith(BEARER_PREFIX)) return undefined;

	const token = header.slice(BEARER_PREFIX.length).trim();
	return token.length > 0 ? token : undefined;
};

class MissingTokenError extends AuthError {
	constructor() {
		super("Authentication token is required", 401, "missing_token");
	}
}

export const requireAuth = async (
	req: Request,
	_res: Response,
	next: NextFunction,
): Promise<void> => {
	const token = getBearerToken(req);
	if (!token) {
		next(new MissingTokenError());
		return;
	}

	try {
		req.user = await getCurrentUser(token);
		req.sessionToken = token;
		next();
	} catch (err) {
		next(err);
	}
};
