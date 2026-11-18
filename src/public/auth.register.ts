import { AuthRequestError, AuthService } from "./shared/auth";

const registerForm = document.querySelector<HTMLFormElement>("#register-form");
const errorBox = registerForm
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
	email_in_use: "Error: this email is already registered",
	username_in_use: "Error: this username is already taken",
	validation_error: "Error: please check the fields and try again",
};

if (registerForm && errorBox) {
	registerForm.addEventListener("submit", async (event) => {
		event.preventDefault();
		errorBox.classList.add("hidden");

		const getField = (id: string): string =>
			registerForm.querySelector<HTMLInputElement>(`#${id}`)?.value ?? "";

		const username = getField("username");
		const email = getField("email");
		const password = getField("password");
		const confirmPassword = getField("confirm-password");

		const isValid = validate([
			{ condition: !username, message: "Error: missing username" },
			{ condition: !email, message: "Error: missing email" },
			{
				condition: !password || !confirmPassword,
				message: "Error: password is required",
			},
			{
				condition: password !== confirmPassword,
				message: "Error: password is not equal to confirm password",
			},
		]);
		if (!isValid) return;

		const authProvider = new AuthService(`${window.location.origin}/auth`);
		try {
			const response = await authProvider.register({
				username,
				email,
				password,
			});
			console.log(
				`User ${response.user.username} created at ${response.user.created_at}`,
			);
		} catch (err) {
			if (err instanceof AuthRequestError) {
				showError(apiErrorMessages[err.code] ?? `Error: ${err.message}`);
				return;
			}
			showError("Error: unable to complete registration");
		}
	});
}
