import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ProjectFile } from "../files/files.repository";

const COMPILE_TIMEOUT_MS = Number(process.env.COMPILE_TIMEOUT_MS ?? 15000);
const MAX_LOG_BYTES = 100 * 1024;
export type CompileResult =
	| { status: "success"; pdf: Uint8Array; durationMs: number }
	| { status: "error"; log: string; durationMs: number }
	| { status: "timeout"; durationMs: number };

type LatexmkResult = {
	stdout: string;
	stderr: string;
	timedOut: boolean;
};

const writeFilesToDir = async (
	files: ProjectFile[],
	dir: string,
): Promise<void> => {
	for (const file of files) {
		const relPath = file.file_path.replace(/^\/+/, "");
		const absPath = join(dir, relPath);
		await mkdir(dirname(absPath), { recursive: true });
		await writeFile(absPath, file.file_content, "utf-8");
	}
};
