import type { DatabaseSettingsDto } from '@open-story/contracts';

import {
  type AdminAssetRecord,
  type AdminStoryGroupRecord,
  type AdminStoryGroupSetRecord,
  type AdminStoryRecord,
  listAssets,
  listPlacements,
  listStoryGroups,
  listStoryGroupSets,
  listStories,
} from './admin-bff';
import { backendApiRequest, BackendApiError } from './backend-api';
import {
  accessMetricKeys,
  contentMetricKeys,
  databaseMetricGroups,
  getDatabaseMetricCount,
  revisionMetricKeys,
  sumDatabaseMetricCounts,
} from '../database-settings-presentation';

export type DashboardDataVolumeStat = {
  label: string;
  value: number;
};

export type DashboardDataVolumeCard = {
  key: 'story-bars' | 'story-groups' | 'stories' | 'assets';
  title: string;
  description: string;
  total: number;
  stats: DashboardDataVolumeStat[];
};

export type DashboardDataVolumeSupportGroup = {
  title: string;
  description: string;
  total: number;
  rows: Array<{
    key: string;
    label: string;
    description: string;
    count: number;
  }>;
};

export type DashboardDataVolumeSnapshot = {
  settings: DatabaseSettingsDto;
  totalCount: number;
  placementsCount: number;
  contentCards: DashboardDataVolumeCard[];
  supportGroups: DashboardDataVolumeSupportGroup[];
};

function hasUnpublishedStoryGroupChanges(storyGroup: AdminStoryGroupRecord): boolean {
  return Boolean(
    storyGroup.currentPublishedRevisionId &&
      storyGroup.currentPublishedRevisionId !== storyGroup.currentDraftRevisionId,
  );
}

function hasUnpublishedStoryChanges(story: AdminStoryRecord): boolean {
  return Boolean(story.currentPublishedRevisionId && story.currentPublishedRevisionId !== story.currentDraftRevisionId);
}

function buildContentCards(
  settings: DatabaseSettingsDto,
  storyGroupSets: AdminStoryGroupSetRecord[],
  storyGroups: AdminStoryGroupRecord[],
  stories: AdminStoryRecord[],
  assets: AdminAssetRecord[],
): DashboardDataVolumeCard[] {
  const activeStoryBars = storyGroupSets.filter((storyGroupSet) => Boolean(storyGroupSet.currentPublishedRevisionId)).length;
  const deactiveStoryBars = storyGroupSets.length - activeStoryBars;

  const publishedStoryGroups = storyGroups.filter((storyGroup) => storyGroup.publishState === 'published').length;
  const unpublishedStoryGroups = storyGroups.length - publishedStoryGroups;
  const draftStoryGroups = storyGroups.filter((storyGroup) => hasUnpublishedStoryGroupChanges(storyGroup)).length;
  const activeStoryGroups = storyGroups.filter((storyGroup) => storyGroup.archiveState === 'active').length;
  const archivedStoryGroups = storyGroups.length - activeStoryGroups;

  const publishedStories = stories.filter((story) => story.publishState === 'published').length;
  const unpublishedStories = stories.length - publishedStories;
  const draftStories = stories.filter((story) => hasUnpublishedStoryChanges(story)).length;
  const activeStories = stories.filter((story) => story.archiveState === 'active').length;
  const archivedStories = stories.length - activeStories;
  const imageStories = stories.filter((story) => story.mediaType === 'image').length;
  const videoStories = stories.length - imageStories;

  const videoAssets = assets.filter((asset) => asset.type === 'story_video').length;
  const imageAssets = assets.length - videoAssets;

  return [
    {
      key: 'story-bars',
      title: 'Story Bars',
      description: 'Placement bazli yayin setlerinin canli ve pasif dagilimi.',
      total: getDatabaseMetricCount(settings, 'storyGroupSets'),
      stats: [
        {
          label: 'Active',
          value: activeStoryBars,
        },
        {
          label: 'Deactive',
          value: deactiveStoryBars,
        },
      ],
    },
    {
      key: 'story-groups',
      title: 'Story Groups',
      description: 'Publish, draft ve archive akisi tek kartta izlenir.',
      total: getDatabaseMetricCount(settings, 'storyGroups'),
      stats: [
        {
          label: 'Published',
          value: publishedStoryGroups,
        },
        {
          label: 'Unpublished',
          value: unpublishedStoryGroups,
        },
        {
          label: 'Draft',
          value: draftStoryGroups,
        },
        {
          label: 'Archived',
          value: archivedStoryGroups,
        },
        {
          label: 'Active',
          value: activeStoryGroups,
        },
      ],
    },
    {
      key: 'stories',
      title: 'Stories',
      description: 'Durum ve medya turu dagilimini birlikte gosterir.',
      total: getDatabaseMetricCount(settings, 'stories'),
      stats: [
        {
          label: 'Published',
          value: publishedStories,
        },
        {
          label: 'Unpublished',
          value: unpublishedStories,
        },
        {
          label: 'Draft',
          value: draftStories,
        },
        {
          label: 'Archived',
          value: archivedStories,
        },
        {
          label: 'Active',
          value: activeStories,
        },
        {
          label: 'Video',
          value: videoStories,
        },
        {
          label: 'Image',
          value: imageStories,
        },
      ],
    },
    {
      key: 'assets',
      title: 'Assets',
      description: 'Tum medya kayitlarinin image ve video kirilimi.',
      total: getDatabaseMetricCount(settings, 'assets'),
      stats: [
        {
          label: 'Video',
          value: videoAssets,
        },
        {
          label: 'Image',
          value: imageAssets,
        },
      ],
    },
  ];
}

function buildSupportGroups(settings: DatabaseSettingsDto): DashboardDataVolumeSupportGroup[] {
  return databaseMetricGroups.map((group) => {
    const rows = group.metrics.map((metric) => ({
      key: metric.key,
      label: metric.label,
      description: metric.description,
      count: getDatabaseMetricCount(settings, metric.key),
    }));

    return {
      title: group.title,
      description: group.description,
      total: rows.reduce((total, row) => total + row.count, 0),
      rows,
    };
  });
}

export async function loadDashboardDataVolumeSnapshot(
  authToken?: string | null,
): Promise<DashboardDataVolumeSnapshot> {
  const [settingsResult, placements, storyGroupSets, storyGroups, stories, assets] = await Promise.all([
    backendApiRequest<DatabaseSettingsDto>('/v1/settings/database', { authToken }).catch((error) => {
      if (error instanceof BackendApiError && error.status === 403) {
        return null;
      }

      throw error;
    }),
    listPlacements(authToken),
    listStoryGroupSets(authToken),
    listStoryGroups(authToken),
    listStories(authToken),
    listAssets(undefined, authToken),
  ]);
  const settings =
    settingsResult ??
    createContentOnlyDatabaseSettings({
      placementsCount: placements.length,
      storyGroupSets,
      storyGroups,
      stories,
      assets,
    });

  return {
    settings,
    totalCount: sumDatabaseMetricCounts(settings, [
      ...accessMetricKeys,
      ...contentMetricKeys,
      ...revisionMetricKeys,
    ]),
    placementsCount: settingsResult ? getDatabaseMetricCount(settings, 'placements') : placements.length,
    contentCards: buildContentCards(settings, storyGroupSets, storyGroups, stories, assets),
    supportGroups: buildSupportGroups(settings),
  };
}

function createContentOnlyDatabaseSettings({
  placementsCount,
  storyGroupSets,
  storyGroups,
  stories,
  assets,
}: {
  placementsCount: number;
  storyGroupSets: AdminStoryGroupSetRecord[];
  storyGroups: AdminStoryGroupRecord[];
  stories: AdminStoryRecord[];
  assets: AdminAssetRecord[];
}): DatabaseSettingsDto {
  return {
    defaultSqliteUrl: '',
    activeProvider: 'sqlite',
    activeDatabaseUrl: '',
    externalDatabaseUrl: null,
    mysqlDatabase: null,
    postgresDatabase: null,
    isUsingExternalDatabase: false,
    migratedAt: null,
    tableCounts: {
      clients: 0,
      staticTokens: 0,
      adminUsers: 0,
      adminSessions: 0,
      placements: placementsCount,
      storyGroupSets: storyGroupSets.length,
      storyGroupSetRevisions: 0,
      storyGroupSetRevisionGroups: 0,
      storyGroups: storyGroups.length,
      storyGroupRevisions: 0,
      storyGroupRevisionStories: 0,
      stories: stories.length,
      storyRevisions: 0,
      assets: assets.length,
    },
  };
}
