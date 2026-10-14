import { createHash } from "node:crypto";
import { password } from "bun";
import {
	createSession,
	createUser,
	deleteSession,
	findUserByEmail,
	type findUserById,
	findUserBySessionToken,
	findUserByUsername,
	updateSessionLastUsed,
	updateUserLastLogin,
} from "./auth.repository";
import type { LoginInput, RegisterInput } from "./auth.schemas";

const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS ?? 30);
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

type UserRow = NonNullable<Awaited<ReturnType<typeof findUserById>>>;

export type PublicUser = {
	id: number;
	username: string;
	email: string;
	created_at: Date;
	last_login_at: Date | null;
};

export type Session = {
	token: string;
	expiresAt: Date;
};

export type AuthResult = {
	user: PublicUser;
	session: Session;
};
export class AuthError extends Error {
	readonly status: number;
	readonly code: string;

	constructor(message: string, status: number, code: string) {
		super(message);
		this.name = new.target.name;
		this.status = status;
		this.code = code;
	}
}

export class EmailAlreadyInUseError extends AuthError {
	constructor() {
		super("Email is already in use", 409, "email_in_use");
	}
}

export class UsernameAlreadyInUseError extends AuthError {
	constructor() {
		super("Username is already in use", 409, "username_in_use");
	}
}

export class InvalidCredentialsError extends AuthError {
	constructor() {
		super("Invalid email or password", 401, "invalid_credentials");
	}
}

export class InvalidSessionError extends AuthError {
	constructor() {
		super("Invalid or expired session", 401, "invalid_session");
	}
}

