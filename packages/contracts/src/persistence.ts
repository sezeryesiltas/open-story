import { z } from 'zod';

import { ctaSchema } from './common/cta.ts';
import { appVersionSchema, platformSchema, userSegmentSchema } from './common/context.ts';
import { revisionIdSchema, rootIdSchema } from './common/revision.ts';
import { adminRoleSchema } from './admin/user.ts';

const timestampSchema = z.string().datetime();
const nullableTimestampSchema = timestampSchema.nullable();
const publicationStatusSchema = z.enum(['draft', 'published']);

const badgeRecordSchema = z
  .object({
    type: z.enum(['emoji', 'svg']),
    value: z.string().trim().min(1).max(1024),
  })
  .strict();

export const storyPlatformTableNameSchema = z.enum([
  'clients',
  'staticTokens',
  'adminApiKeys',
  'adminUsers',
  'adminSessions',
  'placements',
  'assets',
  'storyGroupSets',
  'storyGroupSetRevisions',
  'storyGroupSetRevisionGroups',
  'storyGroups',
  'storyGroupRevisions',
  'storyGroupRevisionStories',
  'stories',
  'storyRevisions',
]);

export const storyPlatformTableNames = [...storyPlatformTableNameSchema.options];

export const platformTargetRecordSchema = z
  .object({
    platform: platformSchema,
    minAppVersion: appVersionSchema,
  })
  .strict();

export const clientRecordSchema = z
  .object({
    id: rootIdSchema,
    clientId: z.string().trim().min(1).max(128),
    name: z.string().trim().min(1).max(256),
    isActive: z.boolean(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const staticTokenRecordSchema = z
  .object({
    id: rootIdSchema,
    clientId: rootIdSchema,
    label: z.string().trim().min(1).max(128),
    tokenHash: z.string().trim().min(1),
    tokenPrefix: z.string().trim().min(6).max(32),
    isActive: z.boolean(),
    revokedAt: nullableTimestampSchema,
    expiresAt: nullableTimestampSchema,
    lastUsedAt: nullableTimestampSchema.optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const adminApiKeyRecordSchema = z
  .object({
    id: rootIdSchema,
    clientName: z.string().trim().min(1).max(128),
    keyPrefix: z.string().trim().min(6).max(64),
    clientSecretHash: z.string().trim().min(1),
    isActive: z.boolean(),
    revokedAt: nullableTimestampSchema,
    lastUsedAt: nullableTimestampSchema.optional(),
    createdByAdminUserId: rootIdSchema.nullable(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const adminUserRecordSchema = z
  .object({
    id: rootIdSchema,
    email: z.string().trim().email(),
    role: adminRoleSchema,
    passwordHash: z.string().trim().min(1),
    mustChangePassword: z.boolean(),
    isActive: z.boolean(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const adminSessionRecordSchema = z
  .object({
    id: rootIdSchema,
    userId: rootIdSchema,
    issuedAt: timestampSchema,
    expiresAt: timestampSchema,
    revokedAt: nullableTimestampSchema,
  })
  .strict();

export const placementRecordSchema = z
  .object({
    id: rootIdSchema,
    key: z.string().trim().min(1).max(128),
    name: z.string().trim().min(1).max(256),
    description: z.string().trim().max(1024).nullable(),
    isActive: z.boolean(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const assetRecordSchema = z
  .object({
    id: rootIdSchema,
    kind: z.enum(['group_logo', 'group_badge_svg', 'story_image', 'story_video', 'story_video_poster']),
    source: z.enum(['upload', 'url', 'cloud_upload']),
    mediaType: z.enum(['image', 'video']),
    storageKey: z.string().trim().min(1).max(1024),
    publicUrl: z.string().url(),
    sourceFileName: z.string().trim().min(1).max(512).nullable(),
    mimeType: z.string().trim().min(1),
    sizeBytes: z.number().int().positive(),
    width: z.number().int().positive().nullable(),
    height: z.number().int().positive().nullable(),
    durationMs: z.number().int().positive().nullable(),
    checksumSha256: z.string().trim().min(1),
    createdByAdminUserId: rootIdSchema.nullable(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const storyGroupSetRootRecordSchema = z
  .object({
    id: rootIdSchema,
    placementId: rootIdSchema,
    name: z.string().trim().min(1).max(256),
    isFallback: z.boolean(),
    isArchived: z.boolean(),
    currentDraftRevisionId: revisionIdSchema,
    currentPublishedRevisionId: revisionIdSchema.nullable(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const storyGroupSetRevisionRecordSchema = z
  .object({
    id: revisionIdSchema,
    storyGroupSetId: rootIdSchema,
    revisionNumber: z.number().int().positive(),
    name: z.string().trim().min(1).max(256),
    status: publicationStatusSchema,
    platformTargets: z.array(platformTargetRecordSchema),
    userSegments: z.array(userSegmentSchema),
    createdByAdminUserId: rootIdSchema.nullable(),
    createdAt: timestampSchema,
  })
  .strict();

export const storyGroupSetRevisionGroupRecordSchema = z
  .object({
    id: rootIdSchema,
    storyGroupSetRevisionId: revisionIdSchema,
    storyGroupId: rootIdSchema,
    sortOrder: z.number().int().min(0),
    createdAt: timestampSchema,
  })
  .strict();

export const storyGroupRootRecordSchema = z
  .object({
    id: rootIdSchema,
    name: z.string().trim().min(1).max(256),
    isArchived: z.boolean(),
    currentDraftRevisionId: revisionIdSchema,
    currentPublishedRevisionId: revisionIdSchema.nullable(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const storyGroupRevisionRecordSchema = z
  .object({
    id: revisionIdSchema,
    storyGroupId: rootIdSchema,
    revisionNumber: z.number().int().positive(),
    name: z.string().trim().min(1).max(256),
    bottomLabel: z.string().trim().min(1).max(256).nullable(),
    logoAssetId: rootIdSchema,
    badge: badgeRecordSchema.nullable(),
    status: publicationStatusSchema,
    createdByAdminUserId: rootIdSchema.nullable(),
    createdAt: timestampSchema,
  })
  .strict();

export const storyGroupRevisionStoryRecordSchema = z
  .object({
    id: rootIdSchema,
    storyGroupRevisionId: revisionIdSchema,
    storyId: rootIdSchema,
    sortOrder: z.number().int().min(0),
    createdAt: timestampSchema,
  })
  .strict();

export const storyRootRecordSchema = z
  .object({
    id: rootIdSchema,
    name: z.string().trim().min(1).max(256),
    isArchived: z.boolean(),
    currentDraftRevisionId: revisionIdSchema,
    currentPublishedRevisionId: revisionIdSchema.nullable(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const storyRevisionRecordSchema = z
  .object({
    id: revisionIdSchema,
    storyId: rootIdSchema,
    revisionNumber: z.number().int().positive(),
    name: z.string().trim().min(1).max(256),
    mediaType: z.enum(['image', 'video']),
    assetId: rootIdSchema,
    posterAssetId: rootIdSchema.nullable(),
    imageDurationMs: z.number().int().positive().nullable(),
    cta: ctaSchema.nullable(),
    status: publicationStatusSchema,
    createdByAdminUserId: rootIdSchema.nullable(),
    createdAt: timestampSchema,
  })
  .strict();

export type StoryPlatformTableName = z.infer<typeof storyPlatformTableNameSchema>;
export type PlatformTargetRecord = z.infer<typeof platformTargetRecordSchema>;
export type ClientRecord = z.infer<typeof clientRecordSchema>;
export type StaticTokenRecord = z.infer<typeof staticTokenRecordSchema>;
export type AdminApiKeyRecord = z.infer<typeof adminApiKeyRecordSchema>;
export type AdminUserRecord = z.infer<typeof adminUserRecordSchema>;
export type AdminSessionRecord = z.infer<typeof adminSessionRecordSchema>;
export type PlacementRecord = z.infer<typeof placementRecordSchema>;
export type AssetRecord = z.infer<typeof assetRecordSchema>;
export type StoryGroupSetRootRecord = z.infer<typeof storyGroupSetRootRecordSchema>;
export type StoryGroupSetRevisionRecord = z.infer<typeof storyGroupSetRevisionRecordSchema>;
export type StoryGroupSetRevisionGroupRecord = z.infer<typeof storyGroupSetRevisionGroupRecordSchema>;
export type StoryGroupRootRecord = z.infer<typeof storyGroupRootRecordSchema>;
export type StoryGroupRevisionRecord = z.infer<typeof storyGroupRevisionRecordSchema>;
export type StoryGroupRevisionStoryRecord = z.infer<typeof storyGroupRevisionStoryRecordSchema>;
export type StoryRootRecord = z.infer<typeof storyRootRecordSchema>;
export type StoryRevisionRecord = z.infer<typeof storyRevisionRecordSchema>;
