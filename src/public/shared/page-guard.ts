import { AuthService } from "./auth";

const authService = new AuthService(`${window.location.origin}/auth`);

export const hasValidSession = (): boolean => {
	const session = authService.getSession();
	if (!session) return false;

	const expiresAt = Date.parse(session.expiresAt);
	return Number.isFinite(expiresAt) && expiresAt > Date.now();
};

const isPublicPage = (): boolean => {
	const { pathname } = window.location;
	return (
		pathname === "/" ||
		pathname.endsWith("/index.html") ||
		pathname.endsWith("/register.html")
	);
};

if (!isPublicPage() && !hasValidSession()) {
	const loginUrl = new URL(
		window.location.pathname.startsWith("/html/")
			? "../index.html"
			: "index.html",
		window.location.href,
	);
	loginUrl.searchParams.set(
		"next",
		`${window.location.pathname}${window.location.search}`,
	);
	window.location.replace(loginUrl.toString());
}
