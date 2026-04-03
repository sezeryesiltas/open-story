import { z } from 'zod';

import { rootIdSchema } from '../common/revision.ts';

export const staticTokenSchema = z
  .object({
    id: rootIdSchema,
    client_id: z.string().trim().min(1).max(128),
    label: z.string().trim().min(1).max(128),
    token_prefix: z.string().trim().min(6).max(32),
    is_active: z.boolean(),
    created_at: z.string().datetime(),
    revoked_at: z.string().datetime().nullable(),
  })
  .strict();

export const createStaticTokenDtoSchema = z
  .object({
    client_id: z.string().trim().min(1).max(128),
    label: z.string().trim().min(1).max(128),
  })
  .strict();

export const revokeStaticTokenDtoSchema = z
  .object({
    reason: z.string().trim().max(512).optional(),
  })
  .strict();

export type StaticToken = z.infer<typeof staticTokenSchema>;
export type CreateStaticTokenDto = z.infer<typeof createStaticTokenDtoSchema>;
export type RevokeStaticTokenDto = z.infer<typeof revokeStaticTokenDtoSchema>;
