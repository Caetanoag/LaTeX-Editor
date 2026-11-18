import { rm } from "node:fs/promises";
import { Glob } from "bun";

await rm("./public/js", { recursive: true, force: true });

const glob = new Glob("**/*.{ts,tsx,js,jsx}");
const entrypoints: string[] = [];

for await (const file of glob.scan("./src/public")) {
	entrypoints.push(`./src/public/${file}`);
}

const result = await Bun.build({
	entrypoints,
	outdir: "./public/js",
	root: "./src/public",
	target: "browser",
	sourcemap: "none",
	minify: true,
});

if (!result.success) {
	console.error("Falha no Build:");
	for (const message of result.logs) {
		console.error(message);
	}
	process.exit(1);
}

console.log(
	`Build concluído com sucesso! ${entrypoints.length} arquivo(s) compilado(s) em public/js/`,
);
