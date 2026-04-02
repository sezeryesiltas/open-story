import type { SdkFeedGroup, SdkFeedResponse, SdkFeedStory } from '@open-story/contracts';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';

import type { AssetRecord } from '@/lib/server/asset-store';
import type { StoryGroupRecord } from '@/lib/server/story-group-store';
import type { StoryGroupSetPlatformTarget } from '@/lib/server/story-group-set-store';
import type { StoryRecord } from '@/lib/server/story-store';

export type PreviewVisibilityReason =
  | 'missing_group'
  | 'group_unpublished'
  | 'group_archived'
  | 'missing_group_logo'
  | 'empty_group'
  | 'missing_story'
  | 'story_unpublished'
  | 'story_archived'
  | 'missing_media_asset'
  | 'missing_poster_asset';

export type PreviewFeedStats = {
  visibleGroupCount: number;
  visibleStoryCount: number;
  hiddenGroupCount: number;
  hiddenStoryCount: number;
  imageCount: number;
  videoCount: number;
  ctaCount: number;
};

export type PreviewVisibilityIssue = {
  entity: 'group' | 'story';
  id: string;
  name: string;
  reason: PreviewVisibilityReason;
  groupId: string | null;
  groupName: string | null;
};

export type InspectablePreviewStoryGroupSet = {
  id: string;
  isFallback: boolean;
  groupIds: string[];
  currentDraftRevisionId: string;
  currentPublishedRevisionId: string | null;
  platformTargets: StoryGroupSetPlatformTarget[];
  userSegments: string[];
};

export type PreviewInspection = {
  feedSet: SdkFeedResponse['resolved_set'];
  stats: PreviewFeedStats;
  issues: PreviewVisibilityIssue[];
};

function toAbsoluteUrl(urlValue: string, origin: string): string {
  try {
    return new URL(urlValue).toString();
  } catch {
    return new URL(urlValue.startsWith('/') ? urlValue : `/${urlValue}`, origin).toString();
  }
}

function inferMimeType(asset: AssetRecord): string {
  if (asset.mimeType) {
    return asset.mimeType;
  }

  const extension = extname(asset.name || asset.url).toLowerCase();

  if (asset.type === 'story_video') {
    return 'video/mp4';
  }

  if (extension === '.png') {
    return 'image/png';
  }

  if (extension === '.webp') {
    return 'image/webp';
  }

  return 'image/jpeg';
}

function buildAssetPayload(asset: AssetRecord, origin: string) {
  return {
    id: asset.id,
    url: toAbsoluteUrl(asset.url, origin),
    mime_type: inferMimeType(asset),
    width: asset.width ?? undefined,
    height: asset.height ?? undefined,
  };
}

export function buildPreviewContractContext(storyGroupSet: {
  platformTargets: StoryGroupSetPlatformTarget[];
  userSegments: string[];
}): SdkFeedResponse['context'] {
  const preferredTarget =
    [...storyGroupSet.platformTargets].sort((left, right) => left.platform.localeCompare(right.platform))[0] ?? null;

  return {
    platform: preferredTarget?.platform ?? 'ios',
    app_version: preferredTarget?.minAppVersion ?? '1.0.0',
    user_segments: storyGroupSet.userSegments,
  };
}

function createEmptyStats(): PreviewFeedStats {
  return {
    visibleGroupCount: 0,
    visibleStoryCount: 0,
    hiddenGroupCount: 0,
    hiddenStoryCount: 0,
    imageCount: 0,
    videoCount: 0,
    ctaCount: 0,
  };
}

function pushGroupIssue(
  issues: PreviewVisibilityIssue[],
  stats: PreviewFeedStats,
  storyGroup: Pick<StoryGroupRecord, 'id' | 'name' | 'storyIds'> | null,
  reason: PreviewVisibilityReason,
  hiddenStoryCountDelta = storyGroup?.storyIds.length ?? 0,
) {
  issues.push({
    entity: 'group',
    id: storyGroup?.id ?? randomUUID(),
    name: storyGroup?.name ?? 'Missing Story Group',
    reason,
    groupId: storyGroup?.id ?? null,
    groupName: storyGroup?.name ?? null,
  });
  stats.hiddenGroupCount += 1;
  stats.hiddenStoryCount += hiddenStoryCountDelta;
}

function incrementHiddenGroupStats(
  stats: PreviewFeedStats,
  hiddenStoryCountDelta: number,
) {
  stats.hiddenGroupCount += 1;
  stats.hiddenStoryCount += hiddenStoryCountDelta;
}

function pushStoryIssue(
  issues: PreviewVisibilityIssue[],
  stats: PreviewFeedStats,
  story: Pick<StoryRecord, 'id' | 'name' | 'groupId' | 'groupName'> | null,
  reason: PreviewVisibilityReason,
) {
  issues.push({
    entity: 'story',
    id: story?.id ?? randomUUID(),
    name: story?.name ?? 'Missing Story',
    reason,
    groupId: story?.groupId ?? null,
    groupName: story?.groupName ?? null,
  });
  stats.hiddenStoryCount += 1;
}

function incrementHiddenStoryStats(stats: PreviewFeedStats) {
  stats.hiddenStoryCount += 1;
}

export function inspectPreviewSetContent({
  storyGroupSet,
  placementKey,
  storyGroupsById,
  storiesById,
  assetsById,
  origin,
}: {
  storyGroupSet: InspectablePreviewStoryGroupSet;
  placementKey: string;
  storyGroupsById: Map<string, StoryGroupRecord>;
  storiesById: Map<string, StoryRecord>;
  assetsById: Map<string, AssetRecord>;
  origin: string;
}): PreviewInspection {
  const stats = createEmptyStats();
  const issues: PreviewVisibilityIssue[] = [];
  const groups: SdkFeedGroup[] = [];

  for (const storyGroupId of storyGroupSet.groupIds) {
    const storyGroup = storyGroupsById.get(storyGroupId);

    if (!storyGroup) {
      pushGroupIssue(issues, stats, null, 'missing_group', 0);
      continue;
    }

    if (storyGroup.archiveState === 'archived') {
      incrementHiddenGroupStats(stats, storyGroup.storyIds.length);
      continue;
    }

    if (storyGroup.publishState !== 'published') {
      pushGroupIssue(issues, stats, storyGroup, 'group_unpublished');
      continue;
    }

    const logoAsset = assetsById.get(storyGroup.logoAssetId);
    if (!logoAsset) {
      pushGroupIssue(issues, stats, storyGroup, 'missing_group_logo');
      continue;
    }

    const stories: SdkFeedStory[] = [];

    for (const storyId of storyGroup.storyIds) {
      const story = storiesById.get(storyId);

      if (!story) {
        pushStoryIssue(issues, stats, null, 'missing_story');
        continue;
      }

      if (story.archiveState === 'archived') {
        incrementHiddenStoryStats(stats);
        continue;
      }

      if (story.publishState !== 'published') {
        pushStoryIssue(issues, stats, story, 'story_unpublished');
        continue;
      }

      const mediaAsset = assetsById.get(story.assetId);
      if (!mediaAsset) {
        pushStoryIssue(issues, stats, story, 'missing_media_asset');
        continue;
      }

      const posterAsset = story.posterAssetId ? assetsById.get(story.posterAssetId) : null;
      if (story.mediaType === 'video' && !posterAsset) {
        pushStoryIssue(issues, stats, story, 'missing_poster_asset');
        continue;
      }

      stories.push({
        id: story.id,
        revision_id: story.currentPublishedRevisionId ?? story.currentDraftRevisionId,
        title: story.name,
        media_type: story.mediaType,
        image_duration_ms: story.imageDurationMs ?? undefined,
        asset: buildAssetPayload(mediaAsset, origin),
        poster_asset: posterAsset ? buildAssetPayload(posterAsset, origin) : undefined,
        cta: story.cta,
      });

      stats.visibleStoryCount += 1;
      if (story.mediaType === 'video') {
        stats.videoCount += 1;
      } else {
        stats.imageCount += 1;
      }
      if (story.cta) {
        stats.ctaCount += 1;
      }
    }

    if (stories.length === 0) {
      pushGroupIssue(issues, stats, storyGroup, 'empty_group', 0);
      continue;
    }

    groups.push({
      id: storyGroup.id,
      revision_id: storyGroup.currentPublishedRevisionId ?? storyGroup.currentDraftRevisionId,
      title: storyGroup.name,
      logo_url: toAbsoluteUrl(logoAsset.url, origin),
      badge: storyGroup.badge,
      stories,
    });
    stats.visibleGroupCount += 1;
  }

  return {
    feedSet: {
      id: storyGroupSet.id,
      revision_id: storyGroupSet.currentPublishedRevisionId ?? storyGroupSet.currentDraftRevisionId,
      placement_key: placementKey,
      is_fallback: storyGroupSet.isFallback,
      groups,
    },
    stats,
    issues,
  };
}
