import type {
  AssetRecord,
  SdkFeedRequestDto,
  SdkFeedResponseDto,
  StoryGroupRevisionRecord,
  StoryGroupRootRecord,
  StoryGroupSetRevisionRecord,
  StoryGroupSetRootRecord,
  StoryRevisionRecord,
  StoryRootRecord,
} from '@open-story/contracts';

import { ApiServiceError } from '../common/filters/api-error.ts';
import {
  enforceNoTargetingConflict,
  enforceSinglePublishedFallback,
  type GroupRevisionSnapshot,
  type PublishedSet,
  type SetRevisionSnapshot,
  PublishConflictError,
} from './publish-guards.ts';
import { PublishResolutionRepository } from './publish-resolution.repository.ts';

type ResolvedSetCandidate = {
  root: StoryGroupSetRootRecord;
  revision: StoryGroupSetRevisionRecord;
  groupIds: string[];
};

type GroupRenderCandidate = {
  root: StoryGroupRootRecord;
  revision: StoryGroupRevisionRecord;
  storyIds: string[];
};

export class PublishResolutionService {
  private readonly repository: PublishResolutionRepository;

  constructor(repository: PublishResolutionRepository) {
    this.repository = repository;
  }

  publishStory(params: { storyId: string; expectedDraftRevisionId?: string }): StoryRootRecord {
    const storyRoot = this.getStoryRootOrThrow(params.storyId);
    this.assertExpectedDraftRevision(storyRoot.currentDraftRevisionId, params.expectedDraftRevisionId);
    this.assertNotArchived(storyRoot.isArchived, 'Archived story cannot be published.');
    const storyRevision = this.getStoryRevisionOrThrow(storyRoot.currentDraftRevisionId);
    if (storyRevision.storyId !== storyRoot.id) {
      throw ApiServiceError.conflict(`Story revision ${storyRevision.id} does not belong to story ${storyRoot.id}.`);
    }

    const publishedStory = this.repository.updateStoryRootPublishedRevision(
      storyRoot.id,
      storyRoot.currentDraftRevisionId,
      new Date().toISOString(),
    );
    this.repository.updateStoryRevisionStatus(storyRoot.currentDraftRevisionId, 'published');

    if (!publishedStory) {
      throw ApiServiceError.notFound('Story not found.');
    }

    return publishedStory;
  }

  publishGroup(params: { groupId: string; expectedDraftRevisionId?: string }): StoryGroupRootRecord {
    const groupRoot = this.getGroupRootOrThrow(params.groupId);
    this.assertExpectedDraftRevision(groupRoot.currentDraftRevisionId, params.expectedDraftRevisionId);
    this.assertNotArchived(groupRoot.isArchived, 'Archived story group cannot be published.');
    const groupRevision = this.getGroupRevisionOrThrow(groupRoot.currentDraftRevisionId);
    if (groupRevision.storyGroupId !== groupRoot.id) {
      throw ApiServiceError.conflict(`Group revision ${groupRevision.id} does not belong to group ${groupRoot.id}.`);
    }

    const publishedGroup = this.repository.updateGroupRootPublishedRevision(
      groupRoot.id,
      groupRoot.currentDraftRevisionId,
      new Date().toISOString(),
    );
    this.repository.updateGroupRevisionStatus(groupRoot.currentDraftRevisionId, 'published');

    if (!publishedGroup) {
      throw ApiServiceError.notFound('Story group not found.');
    }

    return publishedGroup;
  }

  publishSet(params: { setId: string; expectedDraftRevisionId?: string }): StoryGroupSetRootRecord {
    const setRoot = this.getSetRootOrThrow(params.setId);
    this.assertExpectedDraftRevision(setRoot.currentDraftRevisionId, params.expectedDraftRevisionId);
    this.assertNotArchived(setRoot.isArchived, 'Archived story group set cannot be published.');

    const draftSnapshot = this.getSetRevisionSnapshot(setRoot, setRoot.currentDraftRevisionId);
    const incomingSet = this.toPublishedSet(setRoot, draftSnapshot);
    const publishedSets = this.repository
      .listSetRootsByPlacement(setRoot.placementId)
      .filter((candidate) => candidate.currentPublishedRevisionId && !candidate.isArchived)
      .map((candidate) => this.toPublishedSet(candidate, this.getSetRevisionSnapshot(candidate, candidate.currentPublishedRevisionId!)));

    try {
      if (incomingSet.isFallback) {
        if (draftSnapshot.platformTargets.length > 0 || draftSnapshot.userSegments.length > 0) {
          throw new PublishConflictError('Fallback set cannot have targeting rules.');
        }

        enforceSinglePublishedFallback(setRoot.placementId, publishedSets, setRoot.id);
      }

      enforceNoTargetingConflict(setRoot.placementId, incomingSet, publishedSets);
    } catch (error) {
      if (error instanceof PublishConflictError) {
        throw ApiServiceError.conflict(error.message);
      }

      throw error;
    }

    const publishedSet = this.repository.updateSetRootPublishedRevision(
      setRoot.id,
      setRoot.currentDraftRevisionId,
      new Date().toISOString(),
    );
    this.repository.updateSetRevisionStatus(setRoot.currentDraftRevisionId, 'published');

    if (!publishedSet) {
      throw ApiServiceError.notFound('Story group set not found.');
    }

    return publishedSet;
  }

  resolveFeed(payload: SdkFeedRequestDto): SdkFeedResponseDto['resolved_set'] {
    const placement = this.repository.findPlacementByKey(payload.placement_key);
    if (!placement) {
      return null;
    }

    const publishedSets = this.repository
      .listSetRootsByPlacement(placement.id)
      .filter((setRoot) => setRoot.currentPublishedRevisionId && !setRoot.isArchived)
      .map((setRoot) => this.buildResolvedSetCandidate(setRoot));

    const selectedSet = this.selectSet(publishedSets, payload);
    if (!selectedSet) {
      return null;
    }

    const renderedSelectedSet = this.renderSet(selectedSet, placement.key);
    if (renderedSelectedSet.groups.length > 0) {
      return renderedSelectedSet;
    }

    const fallbackSet = publishedSets.find((candidate) => candidate.root.isFallback && candidate.root.id !== selectedSet.root.id);
    if (!fallbackSet) {
      return null;
    }

    const renderedFallbackSet = this.renderSet(fallbackSet, placement.key);
    return renderedFallbackSet.groups.length > 0 ? renderedFallbackSet : null;
  }

  private buildResolvedSetCandidate(setRoot: StoryGroupSetRootRecord): ResolvedSetCandidate {
    const publishedRevisionId = setRoot.currentPublishedRevisionId;

    if (!publishedRevisionId) {
      throw ApiServiceError.conflict(`Set ${setRoot.id} does not have a published revision.`);
    }

    const revision = this.getSetRevisionOrThrow(publishedRevisionId);
    const groupIds = this.repository
      .listSetRevisionGroups(revision.id)
      .map((record) => record.storyGroupId);

    return {
      root: setRoot,
      revision,
      groupIds,
    };
  }

  private renderSet(candidate: ResolvedSetCandidate, placementKey: string): NonNullable<SdkFeedResponseDto['resolved_set']> {
    const groups = candidate.groupIds
      .map((groupId) => this.renderGroup(groupId))
      .filter((group): group is NonNullable<typeof group> => Boolean(group));

    return {
      id: candidate.root.id,
      revision_id: candidate.revision.id,
      placement_key: placementKey,
      is_fallback: candidate.root.isFallback,
      groups,
    };
  }

  private renderGroup(groupId: string): NonNullable<NonNullable<SdkFeedResponseDto['resolved_set']>['groups'][number]> | null {
    const groupRoot = this.repository.findGroupRootById(groupId);
    if (!groupRoot || groupRoot.isArchived || !groupRoot.currentPublishedRevisionId) {
      return null;
    }

    const groupRevision = this.getGroupRevisionOrThrow(groupRoot.currentPublishedRevisionId);
    const logoAsset = this.repository.findAssetById(groupRevision.logoAssetId);
    if (!logoAsset) {
      return null;
    }

    const storyIds = this.repository
      .listGroupRevisionStories(groupRevision.id)
      .map((record) => record.storyId);
    const stories = storyIds
      .map((storyId) => this.renderStory(storyId))
      .filter((story): story is NonNullable<typeof story> => Boolean(story));

    if (stories.length === 0) {
      return null;
    }

    return {
      id: groupRoot.id,
      revision_id: groupRevision.id,
      title: groupRevision.name,
      bottom_label: groupRevision.bottomLabel,
      logo_url: logoAsset.publicUrl,
      badge: groupRevision.badge,
      stories,
    };
  }

  private renderStory(storyId: string): NonNullable<NonNullable<NonNullable<SdkFeedResponseDto['resolved_set']>['groups'][number]>['stories'][number]> | null {
    const storyRoot = this.repository.findStoryRootById(storyId);
    if (!storyRoot || storyRoot.isArchived || !storyRoot.currentPublishedRevisionId) {
      return null;
    }

    const storyRevision = this.getStoryRevisionOrThrow(storyRoot.currentPublishedRevisionId);
    const mainAsset = this.repository.findAssetById(storyRevision.assetId);
    if (!mainAsset) {
      return null;
    }

    const posterAsset = storyRevision.posterAssetId ? this.repository.findAssetById(storyRevision.posterAssetId) : null;
    if (storyRevision.mediaType === 'video' && !posterAsset) {
      return null;
    }

    return {
      id: storyRoot.id,
      revision_id: storyRevision.id,
      title: storyRevision.name,
      media_type: storyRevision.mediaType,
      image_duration_ms: storyRevision.imageDurationMs ?? undefined,
      asset: this.toFeedAsset(mainAsset),
      poster_asset: posterAsset ? this.toFeedAsset(posterAsset) : undefined,
      cta: storyRevision.cta,
    };
  }

  private selectSet(candidates: ResolvedSetCandidate[], payload: SdkFeedRequestDto): ResolvedSetCandidate | null {
    const normalMatches = candidates
      .filter((candidate) => this.isNormalSetMatch(candidate, payload))
      .sort((left, right) => this.compareResolutionRank(left, right, payload));

    if (normalMatches.length > 0) {
      return normalMatches[0];
    }

    return candidates.find((candidate) => candidate.root.isFallback) ?? null;
  }

  private isNormalSetMatch(candidate: ResolvedSetCandidate, payload: SdkFeedRequestDto): boolean {
    if (candidate.root.isFallback) {
      return false;
    }

    const matchingTarget = candidate.revision.platformTargets.find((target) => target.platform === payload.platform);
    if (!matchingTarget) {
      return false;
    }

    if (compareVersions(payload.app_version, matchingTarget.minAppVersion) < 0) {
      return false;
    }

    const requestSegments = new Set((payload.user_segments ?? []).map((segment) => segment.trim()).filter(Boolean));
    const setSegments = new Set(candidate.revision.userSegments);

    if (setSegments.size === 0) {
      return true;
    }

    if (requestSegments.size === 0) {
      return false;
    }

    for (const segment of setSegments) {
      if (requestSegments.has(segment)) {
        return true;
      }
    }

    return false;
  }

  private compareResolutionRank(left: ResolvedSetCandidate, right: ResolvedSetCandidate, payload: SdkFeedRequestDto): number {
    const leftTarget = left.revision.platformTargets.find((target) => target.platform === payload.platform);
    const rightTarget = right.revision.platformTargets.find((target) => target.platform === payload.platform);

    const leftBreadth = left.revision.platformTargets.length;
    const rightBreadth = right.revision.platformTargets.length;
    if (leftBreadth !== rightBreadth) {
      return leftBreadth - rightBreadth;
    }

    const minVersionComparison = compareVersions(
      rightTarget?.minAppVersion ?? '0.0.0',
      leftTarget?.minAppVersion ?? '0.0.0',
    );
    if (minVersionComparison !== 0) {
      return minVersionComparison;
    }

    const leftSegmentSpecificity = left.revision.userSegments.length > 0 ? 1 : 0;
    const rightSegmentSpecificity = right.revision.userSegments.length > 0 ? 1 : 0;
    if (leftSegmentSpecificity !== rightSegmentSpecificity) {
      return rightSegmentSpecificity - leftSegmentSpecificity;
    }

    if (left.revision.userSegments.length !== right.revision.userSegments.length) {
      return left.revision.userSegments.length - right.revision.userSegments.length;
    }

    return left.root.id.localeCompare(right.root.id);
  }

  private getSetRevisionSnapshot(root: StoryGroupSetRootRecord, revisionId: string): SetRevisionSnapshot {
    const revision = this.getSetRevisionOrThrow(revisionId);

    if (revision.storyGroupSetId !== root.id) {
      throw ApiServiceError.conflict(`Set revision ${revisionId} does not belong to set ${root.id}.`);
    }

    return {
      storyGroupIds: this.repository
        .listSetRevisionGroups(revisionId)
        .map((record) => record.storyGroupId),
      platformTargets: revision.platformTargets,
      userSegments: revision.userSegments,
      isFallback: root.isFallback,
    };
  }

  private getGroupRevisionSnapshot(root: StoryGroupRootRecord, revisionId: string): GroupRevisionSnapshot {
    const revision = this.getGroupRevisionOrThrow(revisionId);

    if (revision.storyGroupId !== root.id) {
      throw ApiServiceError.conflict(`Group revision ${revisionId} does not belong to group ${root.id}.`);
    }

    return {
      storyIds: this.repository
        .listGroupRevisionStories(revisionId)
        .map((record) => record.storyId),
    };
  }

  private toPublishedSet(root: StoryGroupSetRootRecord, snapshot: SetRevisionSnapshot): PublishedSet {
    return {
      id: root.id,
      placementId: root.placementId,
      isFallback: root.isFallback,
      targeting: {
        platformTargets: snapshot.platformTargets,
        userSegments: snapshot.userSegments,
      },
    };
  }

  private toFeedAsset(asset: AssetRecord): {
    id: string;
    url: string;
    mime_type: string;
    width?: number;
    height?: number;
    duration_ms?: number;
  } {
    return {
      id: asset.id,
      url: asset.publicUrl,
      mime_type: asset.mimeType,
      width: asset.width ?? undefined,
      height: asset.height ?? undefined,
      duration_ms: asset.durationMs ?? undefined,
    };
  }

  private assertExpectedDraftRevision(currentDraftRevisionId: string, expectedDraftRevisionId?: string): void {
    if (expectedDraftRevisionId && currentDraftRevisionId !== expectedDraftRevisionId) {
      throw ApiServiceError.conflict('Draft revision has changed. Refresh and retry.');
    }
  }

  private assertNotArchived(isArchived: boolean, message: string): void {
    if (isArchived) {
      throw ApiServiceError.conflict(message);
    }
  }

  private getSetRootOrThrow(setId: string): StoryGroupSetRootRecord {
    const setRoot = this.repository.findSetRootById(setId);
    if (!setRoot) {
      throw ApiServiceError.notFound('Story group set not found.');
    }

    return setRoot;
  }

  private getGroupRootOrThrow(groupId: string): StoryGroupRootRecord {
    const groupRoot = this.repository.findGroupRootById(groupId);
    if (!groupRoot) {
      throw ApiServiceError.notFound('Story group not found.');
    }

    return groupRoot;
  }

  private getStoryRootOrThrow(storyId: string): StoryRootRecord {
    const storyRoot = this.repository.findStoryRootById(storyId);
    if (!storyRoot) {
      throw ApiServiceError.notFound('Story not found.');
    }

    return storyRoot;
  }

  private getSetRevisionOrThrow(revisionId: string): StoryGroupSetRevisionRecord {
    const revision = this.repository.findSetRevisionById(revisionId);
    if (!revision) {
      throw ApiServiceError.notFound('Story group set revision not found.');
    }

    return revision;
  }

  private getGroupRevisionOrThrow(revisionId: string): StoryGroupRevisionRecord {
    const revision = this.repository.findGroupRevisionById(revisionId);
    if (!revision) {
      throw ApiServiceError.notFound('Story group revision not found.');
    }

    return revision;
  }

  private getStoryRevisionOrThrow(revisionId: string): StoryRevisionRecord {
    const revision = this.repository.findStoryRevisionById(revisionId);
    if (!revision) {
      throw ApiServiceError.notFound('Story revision not found.');
    }

    return revision;
  }
}

function compareVersions(left: string, right: string): number {
  const leftParts = normalizeVersion(left);
  const rightParts = normalizeVersion(right);

  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;

    if (leftValue > rightValue) {
      return 1;
    }

    if (leftValue < rightValue) {
      return -1;
    }
  }

  return 0;
}

function normalizeVersion(version: string): number[] {
  return String(version || '0')
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
}
