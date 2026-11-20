import { z } from "zod";

export const userIdParamSchema = z.object({
	id: z.coerce.number().int().positive(),
});

export type UserIdParam = z.infer<typeof userIdParamSchema>;
