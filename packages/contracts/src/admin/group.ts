import { z } from 'zod';

import { revisionIdSchema, rootIdSchema } from '../common/revision.ts';

const badgeSchema = z
  .object({
    type: z.enum(['emoji', 'svg']),
    value: z.string().trim().min(1).max(1024),
  })
  .strict();

const bottomLabelSchema = z.string().trim().min(1).max(256);

export const storyGroupSchema = z
  .object({
    id: rootIdSchema,
    current_draft_revision_id: revisionIdSchema,
    current_published_revision_id: revisionIdSchema.nullable(),
    name: z.string().trim().min(1).max(256),
    bottom_label: bottomLabelSchema.nullable(),
    logo_asset_id: rootIdSchema,
    badge: badgeSchema.nullable(),
    story_ids: z.array(rootIdSchema),
    archived_at: z.string().datetime().nullable(),
  })
  .strict();

export const createStoryGroupDtoSchema = z
  .object({
    name: z.string().trim().min(1).max(256),
    bottom_label: bottomLabelSchema.nullable().optional(),
    logo_asset_id: rootIdSchema,
    badge: badgeSchema.nullable().optional(),
    story_ids: z.array(rootIdSchema).default([]),
  })
  .strict();

export const updateStoryGroupDtoSchema = createStoryGroupDtoSchema.partial().strict();

export const publishStoryGroupDtoSchema = z
  .object({
    expected_draft_revision_id: revisionIdSchema.optional(),
  })
  .strict();

export const archiveStoryGroupDtoSchema = z
  .object({
    archived: z.boolean(),
  })
  .strict();

export type StoryGroup = z.infer<typeof storyGroupSchema>;
export type CreateStoryGroupDto = z.infer<typeof createStoryGroupDtoSchema>;
export type UpdateStoryGroupDto = z.infer<typeof updateStoryGroupDtoSchema>;
export type PublishStoryGroupDto = z.infer<typeof publishStoryGroupDtoSchema>;
export type ArchiveStoryGroupDto = z.infer<typeof archiveStoryGroupDtoSchema>;
