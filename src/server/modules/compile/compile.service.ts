import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { ConflictError, NotFoundError } from "../../lib/errors";
import type { ProjectFile } from "../files/files.repository";
import {
	getFile,
	listFiles,
	listProjectFilesWithContent,
} from "../files/files.service";
import { ensureProjectAccess } from "../projects/projects.service";

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

const runLatexmk = (cwd: string, mainFile: string): Promise<LatexmkResult> => {
	return new Promise((resolve) => {
		execFile(
			"latexmk",
			[
				"-pdf",
				"-interaction=nonstopmode",
				"-halt-on-error",
				"-file-line-error",
				"-no-shell-escape",
				mainFile,
			],

			{
				cwd,
				timeout: COMPILE_TIMEOUT_MS,
				maxBuffer: 10 * 1024 * 1024,
				env: {
					PATH: process.env.PATH,
					HOME: cwd,
				},
			},
			(err, stdout, stderr) => {
				let timedOut: boolean = false;
				if (err && typeof err === "object" && "killed" in err) {
					timedOut = Boolean(err.killed);
				}
				resolve({
					stdout: stdout ?? "",
					stderr: stderr ?? "",
					timedOut,
				});
			},
		);
	});
};

const readLogFile = async (
	cwd: string,
	mainRelPath: string,
	fallback: string,
): Promise<string> => {
	const mainDir = dirname(mainRelPath);
	const mainBase = basename(mainRelPath).replace(/\.tex$/, "");
	const logPath = join(cwd, mainDir, `${mainBase}.log`);

	try {
		const content = await readFile(logPath, "utf-8");
		return content.slice(-MAX_LOG_BYTES);
	} catch {
		return fallback.slice(-MAX_LOG_BYTES);
	}
};

const runCompilation = async (
	files: ProjectFile[],
	main: ProjectFile,
): Promise<CompileResult> => {
	const cwd = await mkdtemp(join(tmpdir(), "latex-compile-"));
	const start = Date.now();
	try {
		await writeFilesToDir(files, cwd);
		const mainRelPath = main.file_path.replace(/^\/+/, "");
		const result = await runLatexmk(cwd, mainRelPath);
		const durationMs = Date.now() - start;
		if (result.timedOut) {
			return { status: "timeout", durationMs };
		}
		const mainDir = dirname(mainRelPath);
		const mainBase = basename(mainRelPath).replace(/\.tex$/, "");
		const pdfPath = join(cwd, mainDir, `${mainBase}.pdf`);

		try {
			const pdf = await readFile(pdfPath);
			return { status: "success", pdf, durationMs };
		} catch {
			const log = await readLogFile(
				cwd,
				mainRelPath,
				`${result.stdout}\n${result.stderr}`,
			);
			return { status: "error", log, durationMs };
		}
	} finally {
		await rm(cwd, { recursive: true, force: true });
	}
};

export const compileFile = async (
	fileId: number,
	userId: number,
): Promise<{ result: CompileResult; projectTitle: string }> => {
	const file = await getFile(fileId, userId);
	if (!file) throw new NotFoundError("File not found");
	const { project } = await ensureProjectAccess(file.project_id, userId);
	const files = await listProjectFilesWithContent(project.id, userId);
	const main = files.find((f) => f.is_main);
	if (!main) {
		throw new ConflictError(
			"Project has no main file defined. Mark one before compiling.",
		);
	}
	const result = await runCompilation(files, main);
	return { result, projectTitle: project.title };
};
