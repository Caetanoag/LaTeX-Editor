import { Pool } from "pg";

const pool = new Pool({
	user: process.env.DB_USER,
	host: process.env.DB_HOST,
	database: process.env.DB_NAME,
	password: process.env.DB_PASSWORD,
	port: Number(process.env.DB_PORT ?? 5432),
});

pool.on("error", (err) => {
	console.error("Unexpected error on idle client", err);
});

process.on("SIGTERM", () => pool.end());
process.on("SIGINT", () => pool.end());

export const query = (text: string, params?: unknown[]) => {
	return pool.query(text, params);
};

export default pool;
