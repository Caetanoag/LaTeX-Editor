import { createHash } from "node:crypto";
import { password } from "bun";
import { AppError } from "../../lib/errors";
import {
	createSession,
	createUser,
	deleteSession,
	findUserByEmail,
	findUserBySessionToken,
	findUserByUsername,
	type User,
	updateSessionLastUsed,
	updateUserLastLogin,
} from "./auth.repository";
import type { LoginInput, RegisterInput } from "./auth.schemas";

const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS ?? 30);
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

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
export class AuthError extends AppError {}

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

const toPublicUser = (user: User): PublicUser => ({
	id: user.id,
	username: user.username,
	email: user.email,
	created_at: user.created_at,
	last_login_at: user.last_login_at,
});

const hashPassword = (plain: string): Promise<string> =>
	password.hash(plain, { algorithm: "argon2id" });

const verifyPassword = (plain: string, hash: string): Promise<boolean> =>
	password.verify(plain, hash);

const generateSessionToken = (): string => crypto.randomUUID();

const hashSessionToken = (token: string): string =>
	createHash("sha256").update(token).digest("hex");

const startSession = async (userId: number): Promise<Session> => {
	const token = generateSessionToken();
	const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

	await createSession({
		userId,
		tokenHash: hashSessionToken(token),
		expiresAt,
	});

	return { token, expiresAt };
};

type PgError = { code?: string; constraint?: string };

const isUniqueViolation = (err: unknown): err is PgError =>
	typeof err === "object" && err !== null && (err as PgError).code === "23505";

const uniqueViolationToAuthError = (err: PgError): AuthError =>
	err.constraint?.includes("username")
		? new UsernameAlreadyInUseError()
		: new EmailAlreadyInUseError();

export const register = async (input: RegisterInput): Promise<AuthResult> => {
	const [existingEmail, existingUsername] = await Promise.all([
		findUserByEmail(input.email),
		findUserByUsername(input.username),
	]);

	if (existingEmail) throw new EmailAlreadyInUseError();
	if (existingUsername) throw new UsernameAlreadyInUseError();

	const passwordHash = await hashPassword(input.password);

	let user: User;
	try {
		user = await createUser({
			username: input.username,
			email: input.email,
			passwordHash,
		});
	} catch (err) {
		if (isUniqueViolation(err)) throw uniqueViolationToAuthError(err);
		throw err;
	}

	const session = await startSession(user.id);
	return { user: toPublicUser(user), session };
};

export const login = async (input: LoginInput): Promise<AuthResult> => {
	const user = await findUserByEmail(input.email);

	if (!user) throw new InvalidCredentialsError();

	const passwordMatches = await verifyPassword(
		input.password,
		user.password_hash,
	);
	if (!passwordMatches) throw new InvalidCredentialsError();

	await updateUserLastLogin(user.id);

	const session = await startSession(user.id);
	return { user: toPublicUser(user), session };
};

export const logout = async (token: string): Promise<void> => {
	await deleteSession(hashSessionToken(token));
};

export const getCurrentUser = async (token: string): Promise<PublicUser> => {
	const tokenHash = hashSessionToken(token);

	const user = await findUserBySessionToken(tokenHash);
	if (!user) throw new InvalidSessionError();

	await updateSessionLastUsed(tokenHash);
	return toPublicUser(user);
};
