import { z } from 'zod';

import { appVersionSchema, platformSchema, userSegmentSchema } from '../common/context.ts';
import { revisionIdSchema, rootIdSchema } from '../common/revision.ts';

const setTargetRuleSchema = z
  .object({
    platform: platformSchema,
    min_app_version: appVersionSchema,
  })
  .strict();

export const storyGroupSetSchema = z
  .object({
    id: rootIdSchema,
    current_draft_revision_id: revisionIdSchema,
    current_published_revision_id: revisionIdSchema.nullable(),
    placement_id: rootIdSchema,
    name: z.string().trim().min(1).max(256),
    is_fallback: z.boolean(),
    targets: z.array(setTargetRuleSchema),
    segments: z.array(userSegmentSchema),
    group_ids: z.array(rootIdSchema),
    archived_at: z.string().datetime().nullable(),
  })
  .strict();

export const createStoryGroupSetDtoSchema = z
  .object({
    placement_id: rootIdSchema,
    name: z.string().trim().min(1).max(256),
    is_fallback: z.boolean().default(false),
    targets: z.array(setTargetRuleSchema).default([]),
    segments: z.array(userSegmentSchema).default([]),
    group_ids: z.array(rootIdSchema).default([]),
  })
  .strict();

export const updateStoryGroupSetDtoSchema = createStoryGroupSetDtoSchema
  .partial()
  .strict();

export const publishStoryGroupSetDtoSchema = z
  .object({
    expected_draft_revision_id: revisionIdSchema.optional(),
  })
  .strict();

export type StoryGroupSet = z.infer<typeof storyGroupSetSchema>;
export type CreateStoryGroupSetDto = z.infer<typeof createStoryGroupSetDtoSchema>;
export type UpdateStoryGroupSetDto = z.infer<typeof updateStoryGroupSetDtoSchema>;
export type PublishStoryGroupSetDto = z.infer<typeof publishStoryGroupSetDtoSchema>;
