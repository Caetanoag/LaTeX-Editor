export type Session = {
	token: string;
	expiresAt: string; // ISO
};
export type User = {
	id: number;
	username: string;
	email: string;
	created_at: string;
	last_login_at: string | null;
};
export type LoginInput = { email: string; password: string };
export type RegisterInput = LoginInput & { username: string };
export type AuthResult = { user: User; session: Session };

export class AuthRequestError extends Error {
	constructor(
		message: string,
		public readonly status: number,
		public readonly code: string,
	) {
		super(message);
	}
}
export class AuthService {
	constructor(private baseurl: string) {
		this.baseurl = baseurl;
	}
	private async postAuth(
		path: "/login" | "/register",
		body: LoginInput | RegisterInput,
	): Promise<AuthResult> {
		const response = await fetch(`${this.baseurl}${path}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});

		const data: unknown = await response.json().catch(() => undefined);

		if (!response.ok) {
			const err = data as { error?: string; message?: string } | undefined;
			throw new AuthRequestError(
				err?.message ?? `Request failed with status ${response.status}`,
				response.status,
				err?.error ?? "unknown_error",
			);
		}

		const result = data as AuthResult;
		localStorage.setItem("session", JSON.stringify(result.session));
		return result;
	}
	public getSession(): Session | undefined {
		const raw = localStorage.getItem("session");
		if (!raw) return undefined;
		try {
			const parsed: unknown = JSON.parse(raw);
			if (
				typeof parsed === "object" &&
				parsed !== null &&
				"token" in parsed &&
				typeof parsed.token === "string" &&
				parsed.token.length > 0 &&
				"expiresAt" in parsed &&
				typeof parsed.expiresAt === "string"
			) {
				return parsed as Session;
			}
		} catch {}
		return undefined;
	}
	public async getCurrentUser(): Promise<User | undefined> {
		const session = this.getSession();
		if (!session) return undefined;

		const response = await fetch(`${this.baseurl}/me`, {
			headers: {
				Authorization: `Bearer ${session.token}`,
			},
		});
		if (!response.ok) {
			return undefined;
		}
		const data = (await response.json()) as { user: User };
		return data.user;
	}
	public clearSession(): void {
		localStorage.removeItem("session");
	}

	public async logOut(): Promise<void> {
		const session = this.getSession();
		if (!session) return;

		try {
			const response = await fetch(`${this.baseurl}/logout`, {
				method: "POST",
				headers: { Authorization: `Bearer ${session.token}` },
			});
			if (!response.ok) {
				console.warn(
					`Logout returned HTTP ${response.status}: ${response.statusText}`,
				);
			}
		} finally {
			this.clearSession();
		}
	}
	public login(input: LoginInput): Promise<AuthResult> {
		return this.postAuth("/login", input);
	}

	public register(input: RegisterInput): Promise<AuthResult> {
		return this.postAuth("/register", input);
	}
}
