import { z } from "zod";

export const registerSchema = z.object({
	email: z
		.string()
		.trim()
		.toLowerCase()
		.max(255, "Email address must be less than 255 characters")
		.pipe(z.email({ error: "Invalid email address" })),
	username: z
		.string()
		.trim()
		.min(3, "Username must be at least 3 characters")
		.max(30, "Username must be less than 30 characters")
		.regex(
			/^[a-zA-Z0-9_]+$/,
			"Username can only contain letters, numbers, and underscores",
		),
	password: z
		.string()
		.min(12, "Password must be at least 12 characters")
		.max(128, "Password must be less than 128 characters"),
});

export const loginSchema = z.object({
	email: z
		.string()
		.trim()
		.toLowerCase()
		.max(255)
		.pipe(z.email({ error: "Invalid email address" })),
	password: z.string().min(1, "Password is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
