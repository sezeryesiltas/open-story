import { z } from 'zod';

import { rootIdSchema } from '../common/revision.ts';

export const clientSchema = z
  .object({
    id: rootIdSchema,
    client_id: z.string().trim().min(1).max(128),
    name: z.string().trim().min(1).max(256),
    is_active: z.boolean(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
  })
  .strict();

export const updateClientDtoSchema = z
  .object({
    name: z.string().trim().min(1).max(256).optional(),
    is_active: z.boolean().optional(),
  })
  .strict();

export type Client = z.infer<typeof clientSchema>;
export type UpdateClientDto = z.infer<typeof updateClientDtoSchema>;
