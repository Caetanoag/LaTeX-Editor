import { input } from "zod/v4/mini";
import pool from "../../db/pool";

type User = {
	id: number;
	username: string;
	email: string;
	password_hash: string;
	created_at: Date;
	last_login_at: Date | null;
	updated_at: Date;
	deleted_at: Date | null;
};
const USER_COLUMNS =
	"id, username, email, password_hash, created_at, updated_at, deleted_at, last_login_at";
const COLUMN_MAP = {
	id: "id",
	username: "username",
	email: "email",
} as const;
export const findUserBy = async (
	key: keyof typeof COLUMN_MAP,
	value: string | number,
): Promise<User | undefined> => {
	const query = `
        select ${USER_COLUMNS}
        from users
        where ${COLUMN_MAP[key]} = $1
        and deleted_at is null
    `;
	const values = [value];
	const result = await pool.query<User>(query, values);
	return result.rows[0];
};
export const findUserById = (id: number) => findUserBy("id", id);
export const findUserByEmail = (email: string) => findUserBy("email", email);
export const findUserByUsername = (username: string) =>
	findUserBy("username", username);

export const createUser = async (input: {
	username: string;
	email: string;
	passwordHash: string;
}): Promise<User> => {
	const client = await pool.connect();
	try {
		await client.query("begin");

		const userResult = await client.query<User>(
			`
      insert into users (username, email, password_hash)
      values ($1, $2, $3)
      returning ${USER_COLUMNS}
      `,
			[input.username, input.email, input.passwordHash],
		);

		const user = userResult.rows[0];

		await client.query(
			`
      insert into user_profiles (user_id, display_name)
      values ($1, $2)
      `,
			[user.id, input.username],
		);

		await client.query("commit");
		return user;
	} catch (err) {
		await client.query("rollback");
		throw err;
	} finally {
		client.release();
	}
};

export const createSession = async (input: {
	userId: number;
	tokenHash: string;
	expiresAt: Date;
}): Promise<void> => {
	await pool.query(
		`
        insert into sessions (user_id, token_hash, expires_at)
        values ($1, $2, $3)
        `,
		[input.userId, input.tokenHash, input.expiresAt],
	);
};
export const deleteSession = async (tokenHash: string): Promise<void> => {
	await pool.query(
		`
        delete from sessions
        where token_hash = $1
        `,
		[tokenHash],
	);
};
