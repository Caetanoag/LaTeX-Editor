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
