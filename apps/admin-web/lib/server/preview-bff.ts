import type { SdkFeedResponse } from '@open-story/contracts';

import {
  getClient,
  listAssets,
  listPlacements,
  listStories,
  listStoryGroups,
  listStoryGroupSets,
} from './admin-bff';
import {
  buildPreviewContractContext,
  inspectPreviewSetContent,
} from './preview-inspector';
import type {
  PreviewFeedStats,
  PreviewGroupMeta,
  PreviewPlacementOption,
  PreviewSetSummary,
  PreviewVisibilityIssue,
  PreviewWorkspaceSnapshot,
} from './preview-store';

type PreviewSetRecord = {
  id: string;
  name: string;
  isFallback: boolean;
  groupIds: string[];
  currentDraftRevisionId: string;
  currentPublishedRevisionId: string | null;
  platformTargets: Array<{
    platform: 'ios' | 'android';
    minAppVersion: string;
  }>;
  userSegments: string[];
};

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

function sortPlacements(placements: PreviewPlacementOption[]): PreviewPlacementOption[] {
  return [...placements].sort((left, right) => left.name.localeCompare(right.name, 'en'));
}

function sortSets(storyGroupSets: PreviewSetRecord[]): PreviewSetRecord[] {
  return [...storyGroupSets].sort((left, right) => {
    if (left.isFallback !== right.isFallback) {
      return left.isFallback ? 1 : -1;
    }

    return left.name.localeCompare(right.name, 'en');
  });
}

export async function buildPreviewWorkspaceSnapshotFromApi({
  placementId,
  setId,
  origin,
  authToken,
}: {
  placementId?: string | null;
  setId?: string | null;
  origin: string;
  authToken?: string | null;
}): Promise<PreviewWorkspaceSnapshot> {
  const [client, placements, storyGroupSets, storyGroups, stories, assets] = await Promise.all([
    getClient(authToken),
    listPlacements(authToken),
    listStoryGroupSets(authToken),
    listStoryGroups(authToken),
    listStories(authToken),
    listAssets(undefined, authToken, { includeUsage: false }),
  ]);

  const previewPlacements = sortPlacements(
    placements.map((placement) => ({
      id: placement.id,
      name: placement.name,
      placementKey: placement.key,
      connectedSetCount: placement.connectedSetCount,
    })),
  );

  if (previewPlacements.length === 0) {
    return {
      placements: [],
      selectedPlacementId: null,
      candidateSets: [],
      selectedSetId: null,
      feedResponse: null,
      stats: null,
      issues: [],
      groupMetaById: {},
      warnings: ['Create at least one placement before starting preview.'],
    };
  }

  const selectedPlacement =
    previewPlacements.find((placement) => placement.id === placementId) ?? previewPlacements[0];
  const previewSets = sortSets(
    storyGroupSets
      .filter((storyGroupSet) => storyGroupSet.placementId === selectedPlacement.id)
      .map((storyGroupSet) => ({
        id: storyGroupSet.id,
        name: storyGroupSet.name,
        isFallback: storyGroupSet.isFallback,
        groupIds: storyGroupSet.groupIds,
        currentDraftRevisionId: storyGroupSet.currentDraftRevisionId,
        currentPublishedRevisionId: storyGroupSet.currentPublishedRevisionId,
        platformTargets: storyGroupSet.platformTargets,
        userSegments: storyGroupSet.userSegments,
      })),
  );

  const storyGroupsById = new Map(
    storyGroups.map((storyGroup) => [
      storyGroup.id,
      {
        id: storyGroup.id,
        name: storyGroup.name,
        bottomLabel: storyGroup.bottomLabel,
        currentDraftRevisionId: storyGroup.currentDraftRevisionId,
        currentPublishedRevisionId: storyGroup.currentPublishedRevisionId,
        logoAssetId: storyGroup.logoAssetId,
        badge: storyGroup.badge,
        storyIds: storyGroup.storyIds,
        storyCount: storyGroup.storyCount,
        archiveState: storyGroup.archiveState,
        publishState: storyGroup.publishState,
        archivedAt: storyGroup.archivedAt,
        storyGroupSets: storyGroup.storyGroupSets,
        createdAt: storyGroup.createdAt,
        updatedAt: storyGroup.updatedAt,
      },
    ]),
  );
  const storiesById = new Map(
    stories.map((story) => [
      story.id,
      {
        id: story.id,
        name: story.name,
        currentDraftRevisionId: story.currentDraftRevisionId,
        currentPublishedRevisionId: story.currentPublishedRevisionId,
        groupId: story.groupId,
        groupName: story.groupName,
        position: story.position,
        mediaType: story.mediaType,
        assetId: story.assetId,
        posterAssetId: story.posterAssetId,
        imageDurationMs: story.imageDurationMs,
        cta: story.cta,
        archiveState: story.archiveState,
        publishState: story.publishState,
        archivedAt: story.archivedAt,
        createdAt: story.createdAt,
        updatedAt: story.updatedAt,
        canDelete: story.canDelete,
      },
    ]),
  );
  const assetsById = new Map(
    assets.map((asset) => [
      asset.id,
      {
        id: asset.id,
        type: asset.type,
        url: asset.url,
        name: asset.name,
        mimeType: asset.mimeType,
        width: asset.width,
        height: asset.height,
        sizeBytes: asset.sizeBytes,
        source: asset.source,
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt,
      },
    ]),
  );

  const inspectionBySetId = new Map(
    previewSets.map((storyGroupSet) => [
      storyGroupSet.id,
      inspectPreviewSetContent({
        storyGroupSet,
        placementKey: selectedPlacement.placementKey,
        storyGroupsById,
        storiesById,
        assetsById,
        origin,
      }),
    ]),
  );

  const candidateSets: PreviewSetSummary[] = previewSets.map((storyGroupSet) => {
    const inspection = inspectionBySetId.get(storyGroupSet.id);

    return {
      id: storyGroupSet.id,
      name: storyGroupSet.name,
      isFallback: storyGroupSet.isFallback,
      usesPublishedRevision: Boolean(storyGroupSet.currentPublishedRevisionId),
      groupCount: storyGroupSet.groupIds.length,
      visibleGroupCount: inspection?.stats.visibleGroupCount ?? 0,
      visibleStoryCount: inspection?.stats.visibleStoryCount ?? 0,
      platformTargets: storyGroupSet.platformTargets,
      userSegments: storyGroupSet.userSegments,
    };
  });

  const selectedStoryGroupSet =
    previewSets.find((storyGroupSet) => storyGroupSet.id === setId) ?? previewSets[0] ?? null;

  if (!selectedStoryGroupSet) {
    return {
      placements: previewPlacements,
      selectedPlacementId: selectedPlacement.id,
      candidateSets,
      selectedSetId: null,
      feedResponse: null,
      stats: null,
      issues: [],
      groupMetaById: {},
      warnings: ['The selected placement does not have a Story Bar available for preview yet.'],
    };
  }

  const selectedInspection = inspectionBySetId.get(selectedStoryGroupSet.id) ?? {
    feedSet: null,
    stats: createEmptyStats(),
    issues: [] as PreviewVisibilityIssue[],
  };
  const warnings: string[] = [];

  if (!selectedStoryGroupSet.currentPublishedRevisionId) {
    warnings.push('Because the selected Story Bar is not published yet, preview is calculated from the draft revision.');
  }

  if (candidateSets.length > 1) {
    warnings.push('Preview does not resolve targeting; Story Bar selection under the placement is manual for editorial review.');
  }

  if (selectedInspection.stats.visibleGroupCount === 0) {
    warnings.push('The selected Story Bar produces an empty feed after child filtering.');
  }

  const feedResponse: SdkFeedResponse = {
    client_id: client.clientId,
    placement_key: selectedPlacement.placementKey,
    context: buildPreviewContractContext(selectedStoryGroupSet),
    resolved_set:
      selectedInspection.stats.visibleGroupCount > 0 ? selectedInspection.feedSet : null,
    generated_at: new Date().toISOString(),
  };

  const groupMetaById: Record<string, PreviewGroupMeta> = Object.fromEntries(
    (selectedInspection.feedSet?.groups ?? []).map((group) => [
      group.id,
      {
        bottomLabel: storyGroupsById.get(group.id)?.bottomLabel ?? null,
      },
    ]),
  );

  return {
    placements: previewPlacements,
    selectedPlacementId: selectedPlacement.id,
    candidateSets,
    selectedSetId: selectedStoryGroupSet.id,
    feedResponse,
    stats: selectedInspection.stats,
    issues: selectedInspection.issues,
    groupMetaById,
    warnings,
  };
}
