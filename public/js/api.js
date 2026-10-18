const TOKEN_KEY = "token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export const request = async (path, options = {}) => {
	const { method = "GET", body, isBlob = false } = options;

	const token = getToken();
	const headers = {};

	if (body) headers["Content-Type"] = "application/json";
	if (token) headers["Authorization"] = `Bearer ${token}`;

	const response = await fetch(path, {
		method,
		headers,
		body: body ? JSON.stringify(body) : undefined,
	});

	if (response.status === 401) {
		clearToken();
		window.location.href = "/index.html";
		throw new Error("Sessão expirada");
	}

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));

		const errorMessage =
			errorData.message || errorData.error || "Erro inesperado";
		const error = new Error(errorMessage);

		error.data = errorData;

		throw error;
	}

	if (isBlob) {
		return response.blob();
	}

	return response.json();
};
