import type { SessionInfo } from "./shared/auth";
import { AuthService } from "./shared/auth";
import { hasValidSession } from "./shared/page-guard";

const authService = new AuthService(`${window.location.origin}/auth`);

const accountMessage = document.querySelector<HTMLElement>("#account-message");
const usernameElement =
	document.querySelector<HTMLElement>("#account-username");
const emailElement = document.querySelector<HTMLElement>("#account-email");
const createdElement = document.querySelector<HTMLElement>("#account-created");
const lastLoginElement = document.querySelector<HTMLElement>(
	"#account-last-login",
);
const sessionsBody =
	document.querySelector<HTMLTableSectionElement>("#sessions-body");
const logoutButton =
	document.querySelector<HTMLButtonElement>("#logout-button");
const logoutAllButton =
	document.querySelector<HTMLButtonElement>("#logout-all-button");
const deleteAccountButton = document.querySelector<HTMLButtonElement>(
	"#delete-account-button",
);
const deleteAccountDialog = document.querySelector<HTMLDialogElement>(
	"#delete-account-dialog",
);
const deleteAccountForm = document.querySelector<HTMLFormElement>(
	"#delete-account-form",
);
const deleteAccountPassword = document.querySelector<HTMLInputElement>(
	"#delete-account-password",
);
const deleteAccountError = document.querySelector<HTMLElement>(
	"#delete-account-error",
);
const cancelDeleteAccount = document.querySelector<HTMLButtonElement>(
	"#cancel-delete-account",
);
const confirmDeleteAccount = document.querySelector<HTMLButtonElement>(
	"#confirm-delete-account",
);

const showMessage = (message: string): void => {
	if (!accountMessage) return;
	accountMessage.textContent = message;
	accountMessage.classList.remove("hidden");
};

const setDialogError = (message: string): void => {
	if (!deleteAccountError) return;
	deleteAccountError.textContent = message;
	deleteAccountError.classList.toggle("hidden", message === "");
};

const formatDate = (value: string | null): string => {
	if (!value) return "Never";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "Unknown";
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(date);
};

const finishSession = (): void => {
	authService.clearSession();
	localStorage.removeItem("currentWorkspaceId");
	const loginPath = window.location.pathname.startsWith("/html/")
		? "../index.html"
		: "index.html";
	window.location.replace(new URL(loginPath, window.location.href).toString());
};

const textCell = (text: string): HTMLTableCellElement => {
	const cell = document.createElement("td");
	cell.textContent = text;
	return cell;
};

const loadProfile = async (): Promise<void> => {
	try {
		const user = await authService.getCurrentUser();
		if (!user) {
			finishSession();
			return;
		}
		if (usernameElement) usernameElement.textContent = user.username;
		if (emailElement) emailElement.textContent = user.email;
		if (createdElement)
			createdElement.textContent = formatDate(user.created_at);
		if (lastLoginElement)
			lastLoginElement.textContent = formatDate(user.last_login_at);
	} catch {
		showMessage("Unable to load account information.");
	}
};

const loadSessions = async (): Promise<void> => {
	if (!sessionsBody) return;

	sessionsBody.replaceChildren();
	try {
		const sessions = await authService.getSessions();
		if (sessions.length === 0) {
			const row = document.createElement("tr");
			const cell = textCell("No active sessions.");
			cell.colSpan = 5;
			row.appendChild(cell);
			sessionsBody.appendChild(row);
			return;
		}

		for (const session of sessions) {
			const row = document.createElement("tr");

			const tokenCell = textCell(session.maskedToken);
			if (session.isCurrent) {
				const badge = document.createElement("span");
				badge.className = "session-badge";
				badge.textContent = "Current";
				tokenCell.append(" ", badge);
			}
			row.appendChild(tokenCell);
			row.appendChild(textCell(formatDate(session.created_at)));
			row.appendChild(textCell(formatDate(session.expires_at)));
			row.appendChild(textCell(formatDate(session.last_used_at)));

			const actionCell = document.createElement("td");
			const revokeButton = document.createElement("button");
			revokeButton.type = "button";
			revokeButton.className = "account-button";
			revokeButton.textContent = "Revoke";
			revokeButton.addEventListener("click", () => {
				void revokeSession(session);
			});
			actionCell.appendChild(revokeButton);
			row.appendChild(actionCell);

			sessionsBody.appendChild(row);
		}
	} catch {
		showMessage("Unable to load sessions.");
	}
};

const revokeSession = async (session: SessionInfo): Promise<void> => {
	const label = session.isCurrent
		? "Revoke the current session? You will be signed out."
		: "Revoke this session?";
	if (!window.confirm(label)) return;

	try {
		await authService.revokeSession(session.id);
		if (session.isCurrent) {
			finishSession();
			return;
		}
		await loadSessions();
		showMessage("Session revoked.");
	} catch {
		showMessage("Unable to revoke session.");
	}
};

logoutButton?.addEventListener("click", async () => {
	await authService.logOut();
	finishSession();
});

logoutAllButton?.addEventListener("click", async () => {
	if (!window.confirm("Log out from all devices?")) return;
	try {
		await authService.logoutAll();
		finishSession();
	} catch {
		showMessage("Unable to log out from all devices.");
	}
});

deleteAccountButton?.addEventListener("click", () => {
	setDialogError("");
	deleteAccountForm?.reset();
	deleteAccountDialog?.showModal();
	deleteAccountPassword?.focus();
});

cancelDeleteAccount?.addEventListener("click", () =>
	deleteAccountDialog?.close(),
);

deleteAccountForm?.addEventListener("submit", async (event) => {
	event.preventDefault();
	const password = deleteAccountPassword?.value ?? "";
	if (!password) {
		setDialogError("Password is required.");
		return;
	}

	if (confirmDeleteAccount) confirmDeleteAccount.disabled = true;
	try {
		await authService.deleteAccount(password);
		finishSession();
	} catch {
		setDialogError(
			"Unable to delete account. Check your password and try again.",
		);
	} finally {
		if (confirmDeleteAccount) confirmDeleteAccount.disabled = false;
	}
});

if (document.body.dataset.page === "account" && hasValidSession()) {
	void Promise.all([loadProfile(), loadSessions()]);
}
