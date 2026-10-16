import { z } from "zod";

const VISIBILITIES = ["private", "workspace", "public"] as const;

export const createProjectSchema = z.object({
	workspaceId: z.coerce.number().int().positive(),

	title: z
		.string()
		.trim()
		.min(1, "Title is required")
		.max(200, "Title must be less than 200 characters"),

	description: z
		.string()
		.trim()
		.max(1000, "Description must be less than 1000 characters")
		.optional()
		.nullable()
		.transform((v) => (v === "" ? null : v)),

	visibility: z.enum(VISIBILITIES).optional().default("private"),
});

export const updateProjectSchema = z.object({
	title: z
		.string()
		.trim()
		.min(1, "Title is required")
		.max(200, "Title must be less than 200 characters")
		.optional(),

	description: z
		.string()
		.trim()
		.max(1000, "Description must be less than 1000 characters")
		.optional()
		.nullable()
		.transform((v) => (v === "" ? null : v)),

	visibility: z.enum(VISIBILITIES).optional(),
});

export const listProjectsQuerySchema = z.object({
	workspaceId: z.coerce.number().int().positive().optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
