import { Pool } from "pg";

const pool = new Pool({
	user: process.env.POSTGRES_USER,
	host: process.env.POSTGRES_HOST,
	database: process.env.POSTGRES_DB,
	password: process.env.POSTGRES_PASSWORD,
	port: Number(process.env.POSTGRES_PORT ?? 5432),
});

pool.on("error", (err) => {
	console.error("Unexpected error on idle client", err);
});

process.on("SIGTERM", () => pool.end());
process.on("SIGINT", () => pool.end());

export default pool;
