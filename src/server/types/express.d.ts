import type { PublicUser } from "../modules/auth/auth.service";

declare global {
	namespace Express {
		interface Request {
			user?: PublicUser;
			sessionToken?: string;
		}
	}
}
