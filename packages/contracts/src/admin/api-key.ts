import { z } from 'zod';

import { rootIdSchema } from '../common/revision.ts';

export const adminApiKeySchema = z
  .object({
    id: rootIdSchema,
    clientName: z.string().trim().min(1).max(128),
    keyPrefix: z.string().trim().min(6).max(64),
    isActive: z.boolean(),
    createdAt: z.string().datetime(),
    revokedAt: z.string().datetime().nullable(),
    lastUsedAt: z.string().datetime().nullable(),
  })
  .strict();

export const createAdminApiKeyDtoSchema = z
  .object({
    clientName: z.string().trim().min(1).max(128),
  })
  .strict();

export const createAdminApiKeyResponseSchema = z
  .object({
    apiKey: adminApiKeySchema,
    plainTextApiKey: z.string().trim().min(1),
    clientSecret: z.string().trim().min(1),
  })
  .strict();

export const revokeAdminApiKeyDtoSchema = z
  .object({
    reason: z.string().trim().max(512).optional(),
  })
  .strict();

export type AdminApiKey = z.infer<typeof adminApiKeySchema>;
export type CreateAdminApiKeyDto = z.infer<typeof createAdminApiKeyDtoSchema>;
export type CreateAdminApiKeyResponse = z.infer<typeof createAdminApiKeyResponseSchema>;
export type RevokeAdminApiKeyDto = z.infer<typeof revokeAdminApiKeyDtoSchema>;
