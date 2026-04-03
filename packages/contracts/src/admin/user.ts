import { z } from 'zod';

import { rootIdSchema } from '../common/revision.ts';

export const adminUserSchema = z
  .object({
    id: rootIdSchema,
    email: z.string().trim().email(),
    must_change_password: z.boolean(),
    is_active: z.boolean(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
  })
  .strict();

export const createAdminUserDtoSchema = z
  .object({
    email: z.string().trim().email(),
    temporary_password: z.string().trim().min(8).max(256),
  })
  .strict();

export const resetAdminUserPasswordDtoSchema = z
  .object({
    temporary_password: z.string().trim().min(8).max(256),
  })
  .strict();

export type AdminUser = z.infer<typeof adminUserSchema>;
export type CreateAdminUserDto = z.infer<typeof createAdminUserDtoSchema>;
export type ResetAdminUserPasswordDto = z.infer<typeof resetAdminUserPasswordDtoSchema>;
