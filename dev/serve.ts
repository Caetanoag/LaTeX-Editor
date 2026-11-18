import clipboard from "clipboardy";

const server = Bun.serve({
	port: 0,
	async fetch(req) {
		const url = new URL(req.url);
		let filePath = url.pathname;

		if (filePath === "/") {
			filePath = "/index.html";
		}

		const file = Bun.file(`./public${filePath}`);

		const existe = await file.exists();
		if (!existe) {
			return new Response("Arquivo não encontrado (404)", { status: 404 });
		}

		return new Response(file);
	},
});

const urlLocal = `http://localhost:${server.port}`;
console.log(`Servidor Local ativo em: ${urlLocal}`);

try {
	clipboard.write(urlLocal);
	console.log("URL Local copiada para área de transferência");
} catch (err) {
	console.log("Não foi possivel copiar para área de transferência");
	throw err;
}
