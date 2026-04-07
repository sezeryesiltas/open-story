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
    title: 'Erisim Katmani',
    description: 'Kimlik, token ve panel oturum kayitlari.',
    metrics: [
      {
        key: 'clients',
        label: 'Client',
        description: 'Platformun tek public client kaydi',
      },
      {
        key: 'staticTokens',
        label: 'Static Tokens',
        description: 'SDK erisim tokenlari',
      },
      {
        key: 'adminUsers',
        label: 'Admin Users',
        description: 'Panel kullanici hesaplari',
      },
      {
        key: 'adminSessions',
        label: 'Admin Sessions',
        description: 'Acilmis ve gecmis admin oturumlari',
      },
    ],
  },
  {
    title: 'Revision Katmani',
    description: 'Publish gecmisi ve composition baglantilari.',
    metrics: [
      {
        key: 'storyGroupSetRevisions',
        label: 'Story Bar Revisions',
        description: 'Set publish snapshotlari',
      },
      {
        key: 'storyGroupSetRevisionGroups',
        label: 'Set Group Links',
        description: 'Story bar icindeki grup baglantilari',
      },
      {
        key: 'storyGroupRevisions',
        label: 'Story Group Revisions',
        description: 'Grup publish snapshotlari',
      },
      {
        key: 'storyGroupRevisionStories',
        label: 'Group Story Links',
        description: 'Story group icindeki story baglantilari',
      },
      {
        key: 'storyRevisions',
        label: 'Story Revisions',
        description: 'Story publish snapshotlari',
      },
    ],
  },
];

export function formatDatabaseSettingsDate(value: string | null): string {
  if (!value) {
    return 'Henüz taşınmadı';
  }

  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatMetricCount(value: number): string {
  return new Intl.NumberFormat('tr-TR').format(value);
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