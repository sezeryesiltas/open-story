import type { DatabaseSettingsDto } from '@open-story/contracts';

type DatabaseVolumeMetric = {
  key: string;
  label: string;
  description: string;
};

export type DatabaseVolumeMetricGroup = {
  title: string;
  description: string;
  metrics: DatabaseVolumeMetric[];
};

export const accessMetricKeys = ['clients', 'staticTokens', 'adminUsers', 'adminSessions'];

export const contentMetricKeys = ['placements', 'storyGroupSets', 'storyGroups', 'stories', 'assets'];

export const revisionMetricKeys = [
  'storyGroupSetRevisions',
  'storyGroupSetRevisionGroups',
  'storyGroupRevisions',
  'storyGroupRevisionStories',
  'storyRevisions',
];

export const databaseMetricGroups: DatabaseVolumeMetricGroup[] = [
  {
    title: 'Access Layer',
    description: 'Identity, token, and panel session records.',
    metrics: [
      {
        key: 'clients',
        label: 'Client',
        description: 'The platform single public client record',
      },
      {
        key: 'staticTokens',
        label: 'Static Tokens',
        description: 'SDK access tokens',
      },
      {
        key: 'adminUsers',
        label: 'Admin Users',
        description: 'Panel user accounts',
      },
      {
        key: 'adminSessions',
        label: 'Admin Sessions',
        description: 'Open and historical admin sessions',
      },
    ],
  },
  {
    title: 'Revision Layer',
    description: 'Publish history and composition links.',
    metrics: [
      {
        key: 'storyGroupSetRevisions',
        label: 'Story Bar Revisions',
        description: 'Set publish snapshots',
      },
      {
        key: 'storyGroupSetRevisionGroups',
        label: 'Set Group Links',
        description: 'Group links inside the story bar',
      },
      {
        key: 'storyGroupRevisions',
        label: 'Story Group Revisions',
        description: 'Group publish snapshots',
      },
      {
        key: 'storyGroupRevisionStories',
        label: 'Group Story Links',
        description: 'Story links inside the story group',
      },
      {
        key: 'storyRevisions',
        label: 'Story Revisions',
        description: 'Story publish snapshots',
      },
    ],
  },
];

export function formatMetricCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function getDatabaseMetricCount(
  snapshot: Pick<DatabaseSettingsDto, 'tableCounts'>,
  key: string,
): number {
  return snapshot.tableCounts[key] ?? 0;
}

export function sumDatabaseMetricCounts(
  snapshot: Pick<DatabaseSettingsDto, 'tableCounts'>,
  keys: readonly string[],
): number {
  return keys.reduce((total, key) => total + getDatabaseMetricCount(snapshot, key), 0);
}
