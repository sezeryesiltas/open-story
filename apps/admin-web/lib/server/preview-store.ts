import type { SdkFeedResponse } from '@open-story/contracts';
import { DbService } from '@open-story/db';

import { listAssets } from '@/lib/server/asset-store';
import { listPlacements } from '@/lib/server/placement-store';
import { listStoryGroups } from '@/lib/server/story-group-store';
import { listStoryGroupSets, type StoryGroupSetPlatformTarget, type StoryGroupSetRecord } from '@/lib/server/story-group-set-store';
import { listStories } from '@/lib/server/story-store';
import {
  buildPreviewContractContext,
  inspectPreviewSetContent,
  type PreviewFeedStats as PreviewFeedStatsValue,
  type PreviewVisibilityIssue as PreviewVisibilityIssueValue,
  type PreviewVisibilityReason as PreviewVisibilityReasonValue,
} from '@/lib/server/preview-inspector';

const db = new DbService();
const PREVIEW_CLIENT_ID = 'preview-client';

export type PreviewVisibilityReason = PreviewVisibilityReasonValue;

type PreviewStoryGroupSetRecord = StoryGroupSetRecord & {
  currentDraftRevisionId: string;
  currentPublishedRevisionId: string | null;
};

export type PreviewPlacementOption = {
  id: string;
  name: string;
  placementKey: string;
  connectedSetCount: number;
};

export type PreviewSetSummary = {
  id: string;
  name: string;
  isFallback: boolean;
  usesPublishedRevision: boolean;
  groupCount: number;
  visibleGroupCount: number;
  visibleStoryCount: number;
  platformTargets: StoryGroupSetPlatformTarget[];
  userSegments: string[];
};

export type PreviewFeedStats = PreviewFeedStatsValue;

export type PreviewVisibilityIssue = PreviewVisibilityIssueValue;

export type PreviewGroupMeta = {
  bottomLabel: string | null;
};

export type PreviewWorkspaceSnapshot = {
  placements: PreviewPlacementOption[];
  selectedPlacementId: string | null;
  candidateSets: PreviewSetSummary[];
  selectedSetId: string | null;
  feedResponse: SdkFeedResponse | null;
  stats: PreviewFeedStats | null;
  issues: PreviewVisibilityIssue[];
  groupMetaById: Record<string, PreviewGroupMeta>;
  warnings: string[];
};

type PreviewInspection = {
  feedSet: SdkFeedResponse['resolved_set'];
  stats: PreviewFeedStats;
  issues: PreviewVisibilityIssue[];
};

function parseString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : null;
}

function buildPreviewStoryGroupSets(): PreviewStoryGroupSetRecord[] {
  const baseSets = listStoryGroupSets();
  const rawSetRecords = db.list<{ id: string; [key: string]: unknown }>('storyGroupSets');
  const rawRevisionById = new Map(
    rawSetRecords.map((record) => [
      record.id,
      {
        currentDraftRevisionId:
          parseString(record.currentDraftRevisionId) ??
          parseString(record.current_draft_revision_id) ??
          record.id,
        currentPublishedRevisionId:
          parseString(record.currentPublishedRevisionId) ??
          parseString(record.current_published_revision_id) ??
          parseString(record.publishedRevisionId) ??
          null,
      },
    ]),
  );

  return baseSets.map((storyGroupSet) => {
    const revisionInfo = rawRevisionById.get(storyGroupSet.id);

    return {
      ...storyGroupSet,
      currentDraftRevisionId: revisionInfo?.currentDraftRevisionId ?? storyGroupSet.id,
      currentPublishedRevisionId: revisionInfo?.currentPublishedRevisionId ?? null,
    };
  });
}

function sortPlacements(placements: PreviewPlacementOption[]) {
  return [...placements].sort((left, right) => left.name.localeCompare(right.name, 'tr'));
}

function sortStoryGroupSets(storyGroupSets: PreviewStoryGroupSetRecord[]) {
  return [...storyGroupSets].sort((left, right) => {
    if (left.isFallback !== right.isFallback) {
      return left.isFallback ? 1 : -1;
    }

    return left.name.localeCompare(right.name, 'tr');
  });
}

export function buildPreviewWorkspaceSnapshot({
  placementId,
  setId,
  origin,
}: {
  placementId?: string | null;
  setId?: string | null;
  origin: string;
}): PreviewWorkspaceSnapshot {
  const placements = sortPlacements(
    listPlacements().map((placement) => ({
      id: placement.id,
      name: placement.name,
      placementKey: placement.key,
      connectedSetCount: placement.connectedSetCount,
    })),
  );

  if (placements.length === 0) {
    return {
      placements,
      selectedPlacementId: null,
      candidateSets: [],
      selectedSetId: null,
      feedResponse: null,
      stats: null,
      issues: [],
      groupMetaById: {},
      warnings: ['Preview başlatmak için önce en az bir placement oluşturulmalıdır.'],
    };
  }

  const selectedPlacement =
    placements.find((placement) => placement.id === placementId) ??
    placements[0];
  const previewStoryGroupSets = sortStoryGroupSets(
    buildPreviewStoryGroupSets().filter((storyGroupSet) => storyGroupSet.placementId === selectedPlacement.id),
  );

  const storyGroupsById = new Map(listStoryGroups().map((storyGroup) => [storyGroup.id, storyGroup]));
  const storiesById = new Map(listStories().map((story) => [story.id, story]));
  const assetsById = new Map(listAssets().map((asset) => [asset.id, asset]));

  const inspectionBySetId = new Map(
    previewStoryGroupSets.map((storyGroupSet) => [
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

  const candidateSets: PreviewSetSummary[] = previewStoryGroupSets.map((storyGroupSet) => {
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
    previewStoryGroupSets.find((storyGroupSet) => storyGroupSet.id === setId) ??
    previewStoryGroupSets[0] ??
    null;

  if (!selectedStoryGroupSet) {
    return {
      placements,
      selectedPlacementId: selectedPlacement.id,
      candidateSets,
      selectedSetId: null,
      feedResponse: null,
      stats: null,
      issues: [],
      groupMetaById: {},
      warnings: [
        'Seçili placement altında henüz preview edilebilecek bir Story Bar bulunmuyor.',
      ],
    };
  }

  const selectedInspection = inspectionBySetId.get(selectedStoryGroupSet.id) ?? {
    feedSet: null,
    stats: {
      visibleGroupCount: 0,
      visibleStoryCount: 0,
      hiddenGroupCount: 0,
      hiddenStoryCount: 0,
      imageCount: 0,
      videoCount: 0,
      ctaCount: 0,
    },
    issues: [],
  };
  const warnings: string[] = [];

  if (!selectedStoryGroupSet.currentPublishedRevisionId) {
    warnings.push(
      'Story Bar publish lifecycle henüz admin verisinde bulunmadığı için preview Story Bar revision olarak current draft id kullanır.',
    );
  }

  if (candidateSets.length > 1) {
    warnings.push(
      'Targeting context simülasyonu yerine placement altındaki Story Bar seçimi manuel yapılır.',
    );
  }

  if (selectedInspection.stats.visibleGroupCount === 0) {
    warnings.push(
      'Seçili Story Bar child filtering sonrasında boş feed üretiyor. Preview yalnızca görünür group ve story kayıtlarını render eder.',
    );
  }

  const feedResponse: SdkFeedResponse = {
    client_id: PREVIEW_CLIENT_ID,
    placement_key: selectedPlacement.placementKey,
    context: buildPreviewContractContext(selectedStoryGroupSet),
    resolved_set:
      selectedInspection.stats.visibleGroupCount > 0 ? selectedInspection.feedSet : null,
    generated_at: new Date().toISOString(),
  };
  const groupMetaById = Object.fromEntries(
    (selectedInspection.feedSet?.groups ?? []).map((group) => [
      group.id,
      {
        bottomLabel: storyGroupsById.get(group.id)?.bottomLabel ?? null,
      },
    ]),
  );

  return {
    placements,
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
