export const request = async (path, options = {}) => {
	const { method = "GET", body, isBlob = false } = options;

	const token = localStorage.getItem("token");

	const headers = {};
	if (body) headers["Content-Type"] = "application/json";
	if (token) headers["Authorization"] = `Bearer ${token}`;

	const response = await fetch(path, {
		method,
		headers,
		body: body ? JSON.stringify(body) : undefined,
	});

	if (response.status === 401) {
		localStorage.removeItem("token");
		window.location.href = "/index.html";
		throw new Error("Sessão expirada");
	}

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.message || errorData.error || "Erro inesperado");
	}

	if (isBlob) {
		return response.blob();
	}

	return response.json();
};
