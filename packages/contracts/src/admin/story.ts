import { z } from 'zod';

import { ctaSchema } from '../common/cta';
import { revisionIdSchema, rootIdSchema } from '../common/revision';

export const storySchema = z
  .object({
    id: rootIdSchema,
    current_draft_revision_id: revisionIdSchema,
    current_published_revision_id: revisionIdSchema.nullable(),
    group_id: rootIdSchema,
    name: z.string().trim().min(1).max(256),
    media_type: z.enum(['image', 'video']),
    asset_id: rootIdSchema,
    poster_asset_id: rootIdSchema.nullable(),
    image_duration_ms: z.number().int().positive().nullable(),
    cta: ctaSchema.nullable(),
    archived_at: z.string().datetime().nullable(),
  })
  .strict();

export const createStoryDtoSchema = z
  .object({
    group_id: rootIdSchema,
    name: z.string().trim().min(1).max(256),
    media_type: z.enum(['image', 'video']),
    asset_id: rootIdSchema,
    poster_asset_id: rootIdSchema.nullable().optional(),
    image_duration_ms: z.number().int().positive().nullable().optional(),
    cta: ctaSchema.nullable().optional(),
  })
  .strict();

export const updateStoryDtoSchema = createStoryDtoSchema
  .omit({ group_id: true })
  .partial()
  .strict();

export const publishStoryDtoSchema = z
  .object({
    expected_draft_revision_id: revisionIdSchema.optional(),
  })
  .strict();

export const archiveStoryDtoSchema = z
  .object({
    archived: z.boolean(),
  })
  .strict();

export type Story = z.infer<typeof storySchema>;
export type CreateStoryDto = z.infer<typeof createStoryDtoSchema>;
export type UpdateStoryDto = z.infer<typeof updateStoryDtoSchema>;
export type PublishStoryDto = z.infer<typeof publishStoryDtoSchema>;
export type ArchiveStoryDto = z.infer<typeof archiveStoryDtoSchema>;
