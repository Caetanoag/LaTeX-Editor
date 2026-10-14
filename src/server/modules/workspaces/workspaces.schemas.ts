import { z } from "zod";

export const createWorkspaceSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Name is required")
		.max(100, "Name must be less than 100 characters"),

	description: z
		.string()
		.trim()
		.max(500, "Description must be less than 500 characters")
		.optional()
		.nullable()
		.transform((v) => (v === "" ? null : v)),
});
export const updateWorkspaceSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Name is required")
		.max(100, "Name must be less than 100 characters")
		.optional(),

	description: z
		.string()
		.trim()
		.max(500, "Description must be less than 500 characters")
		.optional()
		.nullable()
		.transform((v) => (v === "" ? null : v)),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
