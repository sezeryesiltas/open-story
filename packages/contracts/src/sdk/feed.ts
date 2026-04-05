import { z } from 'zod';

import { ctaSchema } from '../common/cta.ts';
import { appVersionSchema, platformSchema, userSegmentsSchema } from '../common/context.ts';
import { revisionIdSchema, rootIdSchema } from '../common/revision.ts';

export const sdkFeedRequestSchema = z
  .object({
    client_id: z.string().trim().min(1).max(128),
    placement_key: z.string().trim().min(1).max(128),
    platform: platformSchema,
    app_version: appVersionSchema,
    user_segments: userSegmentsSchema.optional().default([]),
  })
  .strict();

const assetSchema = z
  .object({
    id: rootIdSchema,
    url: z.string().url(),
    mime_type: z.string().trim().min(1),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    duration_ms: z.number().int().positive().optional(),
  })
  .strict();

const sdkFeedStorySchema = z
  .object({
    id: rootIdSchema,
    revision_id: revisionIdSchema,
    title: z.string().trim().min(1).max(256),
    media_type: z.enum(['image', 'video']),
    image_duration_ms: z.number().int().positive().optional(),
    asset: assetSchema,
    poster_asset: assetSchema.optional(),
    cta: ctaSchema.nullable(),
  })
  .strict();

const sdkFeedGroupSchema = z
  .object({
    id: rootIdSchema,
    revision_id: revisionIdSchema,
    title: z.string().trim().min(1).max(256),
    bottom_label: z.string().trim().min(1).max(256).nullable(),
    logo_url: z.string().url(),
    badge: z
      .object({
        type: z.enum(['emoji', 'svg']),
        value: z.string().trim().min(1).max(1024),
      })
      .strict()
      .nullable(),
    stories: z.array(sdkFeedStorySchema),
  })
  .strict();

const sdkFeedSetSchema = z
  .object({
    id: rootIdSchema,
    revision_id: revisionIdSchema,
    placement_key: z.string().trim().min(1).max(128),
    is_fallback: z.boolean(),
    groups: z.array(sdkFeedGroupSchema),
  })
  .strict();

export const sdkFeedResponseSchema = z
  .object({
    client_id: z.string().trim().min(1).max(128),
    placement_key: z.string().trim().min(1).max(128),
    context: z
      .object({
        platform: platformSchema,
        app_version: appVersionSchema,
        user_segments: userSegmentsSchema,
      })
      .strict(),
    resolved_set: sdkFeedSetSchema.nullable(),
    generated_at: z.string().datetime(),
  })
  .strict();

export type SdkFeedRequest = z.infer<typeof sdkFeedRequestSchema>;
export type SdkFeedResponse = z.infer<typeof sdkFeedResponseSchema>;
export type SdkFeedSet = z.infer<typeof sdkFeedSetSchema>;
export type SdkFeedGroup = z.infer<typeof sdkFeedGroupSchema>;
export type SdkFeedStory = z.infer<typeof sdkFeedStorySchema>;
