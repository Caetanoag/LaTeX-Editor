import { NotFoundError } from "../../lib/errors";
import { findUserById } from "./users.repository";

export type UserProfile = {
	id: number;
	username: string;
	created_at: Date;
	last_login_at: Date | null;
};

export const getUserById = async (id: number): Promise<UserProfile> => {
	const user = await findUserById(id);
	if (!user) {
		throw new NotFoundError(`User with id ${id} not found`);
	}

	return {
		id: user.id,
		username: user.username,
		created_at: user.created_at,
		last_login_at: user.last_login_at,
	};
};
