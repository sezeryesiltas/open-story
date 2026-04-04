import type {
  StoryDto,
  StoryGroupDto,
  StoryGroupSetDto,
  StoryGroupRevisionRecord,
  StoryGroupRootRecord,
  StoryGroupSetRevisionRecord,
  StoryGroupSetRootRecord,
  StoryRevisionRecord,
  StoryRootRecord,
} from '@open-story/contracts';

export const toAdminSetDto = (
  root: StoryGroupSetRootRecord,
  draftRevision: StoryGroupSetRevisionRecord,
  groupIds: string[],
): StoryGroupSetDto => ({
  id: root.id,
  current_draft_revision_id: root.currentDraftRevisionId,
  current_published_revision_id: root.currentPublishedRevisionId,
  created_at: root.createdAt,
  updated_at: root.updatedAt,
  placement_id: root.placementId,
  name: draftRevision.name,
  is_fallback: root.isFallback,
  targets: draftRevision.platformTargets.map((target) => ({
    platform: target.platform,
    min_app_version: target.minAppVersion,
  })),
  segments: [...draftRevision.userSegments],
  group_ids: [...groupIds],
  archived_at: root.isArchived ? root.updatedAt : null,
});

export const toAdminGroupDto = (
  root: StoryGroupRootRecord,
  draftRevision: StoryGroupRevisionRecord,
  storyIds: string[],
): StoryGroupDto => ({
  id: root.id,
  current_draft_revision_id: root.currentDraftRevisionId,
  current_published_revision_id: root.currentPublishedRevisionId,
  created_at: root.createdAt,
  updated_at: root.updatedAt,
  name: draftRevision.name,
  bottom_label: draftRevision.bottomLabel,
  logo_asset_id: draftRevision.logoAssetId,
  badge: draftRevision.badge,
  story_ids: [...storyIds],
  archived_at: root.isArchived ? root.updatedAt : null,
});

export const toAdminStoryDto = (
  root: StoryRootRecord,
  draftRevision: StoryRevisionRecord,
  groupId: string,
): StoryDto => ({
  id: root.id,
  current_draft_revision_id: root.currentDraftRevisionId,
  current_published_revision_id: root.currentPublishedRevisionId,
  created_at: root.createdAt,
  updated_at: root.updatedAt,
  group_id: groupId,
  name: draftRevision.name,
  media_type: draftRevision.mediaType,
  asset_id: draftRevision.assetId,
  poster_asset_id: draftRevision.posterAssetId,
  image_duration_ms: draftRevision.imageDurationMs,
  cta: draftRevision.cta,
  archived_at: root.isArchived ? root.updatedAt : null,
});
