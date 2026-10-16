import { z } from "zod";

const FILE_PATH_REGEX = /^\/[a-zA-Z0-9._\-/]+$/;
const ALLOWED_EXTENSIONS = /\.(tex|bib|sty|cls|txt)$/;

const filePathSchema = z
	.string()
	.trim()
	.min(2, "Path is required")
	.max(255, "Path must be less than 255 characters")
	.refine((p) => p.startsWith("/"), "Path must start with /")
	.refine((p) => !p.includes(".."), "Path cannot contain '..'")
	.refine((p) => !p.includes("//"), "Path cannot contain '//'")
	.refine((p) => FILE_PATH_REGEX.test(p), "Path contains invalid characters")
	.refine(
		(p) => ALLOWED_EXTENSIONS.test(p),
		"Path must have a valid extension (.tex, .bib, .sty, .cls, .txt)",
	);

export const createFileSchema = z.object({
	filePath: filePathSchema,
	fileContent: z
		.string()
		.max(500_000, "File content must be less than 500KB")
		.optional()
		.default(""),
	isMain: z.boolean().optional().default(false),
});

export const updateFileSchema = z.object({
	fileContent: z.string().max(500_000, "File content must be less than 500KB"),
});

export type CreateFileInput = z.infer<typeof createFileSchema>;
export type UpdateFileInput = z.infer<typeof updateFileSchema>;
