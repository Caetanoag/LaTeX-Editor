import { AuthRequestError, AuthService } from "./shared/auth";

const loginForm = document.querySelector<HTMLFormElement>("#auth-form");
const errorBox = loginForm
	?.closest(".form-box")
	?.querySelector<HTMLDivElement>(".error-container");

type ValidationError = {
	condition: boolean;
	message: string;
};

const showError = (message: string): void => {
	if (!errorBox) return;
	errorBox.replaceChildren();
	const p = document.createElement("p");
	p.textContent = message;
	errorBox.appendChild(p);
	errorBox.classList.remove("hidden");
};

const validate = (errors: ValidationError[]): boolean => {
	for (const { condition, message } of errors) {
		if (condition) {
			showError(message);
			return false;
		}
	}
	return true;
};

const apiErrorMessages: Record<string, string> = {
	invalid_credentials: "Error: invalid email or password",
};

if (loginForm && errorBox) {
	loginForm.addEventListener("submit", async (event) => {
		event.preventDefault();
		errorBox.classList.add("hidden");
		const getField = (id: string): string =>
			loginForm.querySelector<HTMLInputElement>(`#${id}`)?.value ?? "";
		const email = getField("email");
		const password = getField("password");

		const isValid = validate([
			{ condition: !password, message: "Error: missing password" },
			{ condition: !email, message: "Error: missing email" },
		]);
		if (!isValid) return;
		const authProvider = new AuthService(`${window.location.origin}/auth`);
		try {
			const response = await authProvider.login({
				email,
				password,
			});
			console.log(
				`User ${response.user.username} logged in (${response.user.created_at})`,
			);
			const requestedPath = new URLSearchParams(window.location.search).get(
				"next",
			);
			const destination =
				requestedPath?.startsWith("/") &&
				new URL(requestedPath, window.location.origin).origin ===
					window.location.origin
					? requestedPath
					: "html/dashboard.html";
			window.location.assign(destination);
		} catch (err) {
			if (err instanceof AuthRequestError) {
				showError(apiErrorMessages[err.code] ?? `Error: ${err.message}`);
				return;
			}
			showError("Error: unable to complete registration");
		}
	});
}
