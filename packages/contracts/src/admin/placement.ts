import { z } from 'zod';

import { rootIdSchema } from '../common/revision.ts';

export const placementSchema = z
  .object({
    id: rootIdSchema,
    key: z.string().trim().min(1).max(128),
    name: z.string().trim().min(1).max(256),
    description: z.string().trim().max(1024).nullable().optional(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
  })
  .strict();

export const createPlacementDtoSchema = z
  .object({
    key: z.string().trim().min(1).max(128),
    name: z.string().trim().min(1).max(256),
    description: z.string().trim().max(1024).optional(),
  })
  .strict();

export const updatePlacementDtoSchema = createPlacementDtoSchema.partial().strict();

export type Placement = z.infer<typeof placementSchema>;
export type CreatePlacementDto = z.infer<typeof createPlacementDtoSchema>;
export type UpdatePlacementDto = z.infer<typeof updatePlacementDtoSchema>;
