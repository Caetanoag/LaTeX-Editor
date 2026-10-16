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
