import { Badge } from '@open-story/ui/components/badge';
import { Button } from '@open-story/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@open-story/ui/components/card';
import { Separator } from '@open-story/ui/components/separator';
import Link from 'next/link';
import {
  Clapperboard,
  Database,
  HardDriveDownload,
  type LucideIcon,
  Layers3,
  SquareStack,
} from 'lucide-react';
import { Fragment } from 'react';

import { formatDatabaseSettingsDate, formatMetricCount } from '@/lib/database-settings-presentation';
import type {
  DashboardDataVolumeCard,
  DashboardDataVolumeSnapshot,
} from '@/lib/server/dashboard-data-volume';

const contentCardIcons: Record<DashboardDataVolumeCard['key'], LucideIcon> = {
  'story-bars': Layers3,
  'story-groups': SquareStack,
  stories: Clapperboard,
  assets: HardDriveDownload,
};

function getCardStat(card: DashboardDataVolumeCard, label: string): number {
  return card.stats.find((stat) => stat.label === label)?.value ?? 0;
}

function getMetricBarWidth(count: number, maxCount: number): number {
  if (count <= 0 || maxCount <= 0) {
    return 0;
  }

  return Math.max(Math.round((count / maxCount) * 100), 12);
}

function getDatabaseProviderLabel(settings: DashboardDataVolumeSnapshot['settings']): string {
  if (settings.activeProvider === 'postgres') {
    return 'Harici Postgres aktif';
  }

  if (settings.activeProvider === 'mysql') {
    return 'Harici MySQL aktif';
  }

  return settings.isUsingExternalDatabase ? 'Harici SQLite aktif' : 'Yerel SQLite aktif';
}

export function DashboardDataVolume({
  snapshot,
  errorMessage,
}: {
  snapshot: DashboardDataVolumeSnapshot | null;
  errorMessage?: string;
}) {
  if (!snapshot) {
    return (
      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle>Aktif veri hacmi okunamadi</CardTitle>
          <CardDescription>
            {errorMessage ?? 'Database snapshot su anda yuklenemiyor. Ayarlari DB Settings ekranindan kontrol edin.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/settings">
              <Database data-icon="inline-start" />
              DB Settings
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { contentCards, placementsCount, settings, supportGroups, totalCount } = snapshot;
  const storyBarsCard = contentCards.find((card) => card.key === 'story-bars') ?? null;
  const storyGroupsCard = contentCards.find((card) => card.key === 'story-groups') ?? null;
  const storiesCard = contentCards.find((card) => card.key === 'stories') ?? null;
  const assetsCard = contentCards.find((card) => card.key === 'assets') ?? null;

  const executiveStats = [
    {
      label: 'Live Story Bars',
      value: storyBarsCard ? getCardStat(storyBarsCard, 'Active') : 0,
      note: `${formatMetricCount(storyBarsCard?.total ?? 0)} total`,
    },
    {
      label: 'Published Groups',
      value: storyGroupsCard ? getCardStat(storyGroupsCard, 'Published') : 0,
      note: `${formatMetricCount(storyGroupsCard ? getCardStat(storyGroupsCard, 'Draft') : 0)} draft`,
    },
    {
      label: 'Published Stories',
      value: storiesCard ? getCardStat(storiesCard, 'Published') : 0,
      note: `${formatMetricCount(storiesCard ? getCardStat(storiesCard, 'Video') : 0)} video`,
    },
    {
      label: 'Video Assets',
      value: assetsCard ? getCardStat(assetsCard, 'Video') : 0,
      note: `${formatMetricCount(assetsCard ? getCardStat(assetsCard, 'Image') : 0)} image`,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <section className="grid gap-4">
        <Card className="border-border/60 bg-gradient-to-br from-card via-card to-muted/30">
          <CardHeader className="border-b border-border/60">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={settings.isUsingExternalDatabase ? 'default' : 'secondary'}>
                    {getDatabaseProviderLabel(settings)}
                  </Badge>
                  <Badge variant="outline">Placements: {formatMetricCount(placementsCount)}</Badge>
                  <Badge variant="outline">Son kopyalama: {formatDatabaseSettingsDate(settings.migratedAt)}</Badge>
                </div>
                <div className="flex flex-col gap-2">
                  <CardTitle>Aktif veri hacmi</CardTitle>
                  <CardDescription>
                    Story Bars, Story Groups, Stories ve Assets kirilimlari operasyonel durum sayilariyla birlikte gosterilir.
                  </CardDescription>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-background/70 px-4 py-3 text-right">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Toplam kayit</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight">{formatMetricCount(totalCount)}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Platformun tum tablo satirlari tek snapshot&#39;ta gorunur.
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {executiveStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-border/60 bg-background/70 p-4"
                >
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{stat.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
                    {formatMetricCount(stat.value)}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{stat.note}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
            {contentCards.map((card) => {
              const Icon = contentCardIcons[card.key] ?? Database;

              return (
                <div
                  key={card.key}
                  className="flex h-full flex-col gap-4 rounded-xl border border-border/60 bg-background/70 p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
                        <Icon aria-hidden size={18} />
                      </div>
                      <div className="flex min-w-0 flex-col gap-1">
                        <p className="text-sm font-medium">{card.title}</p>
                        <p className="text-xs leading-5 text-muted-foreground">{card.description}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Toplam</p>
                      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                        {formatMetricCount(card.total)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {card.stats.map((stat) => (
                      <Badge
                        key={`${card.key}-${stat.label}`}
                        className="gap-2 px-3 py-1.5"
                        variant="outline"
                      >
                        <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{stat.label}</span>
                        <span className="text-sm font-semibold tabular-nums text-foreground">
                          {formatMetricCount(stat.value)}
                        </span>
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {supportGroups.map((group) => {
          const maxCount = Math.max(...group.rows.map((row) => row.count), 1);

          return (
            <Card key={group.title} className="border-border/60 bg-card/80">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-2">
                    <CardTitle className="text-xl">{group.title}</CardTitle>
                    <CardDescription>{group.description}</CardDescription>
                  </div>
                  <Badge variant="secondary">{formatMetricCount(group.total)}</Badge>
                </div>
              </CardHeader>

              <CardContent>
                <div className="flex flex-col gap-4">
                  {group.rows.map((row, index) => (
                    <Fragment key={row.key}>
                      {index > 0 ? <Separator /> : null}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{row.label}</p>
                            <p className="text-xs leading-5 text-muted-foreground">{row.description}</p>
                          </div>
                          <p className="text-lg font-semibold tabular-nums">{formatMetricCount(row.count)}</p>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-muted/70">
                          <div
                            className="h-full rounded-full bg-foreground/80"
                            style={{ width: `${getMetricBarWidth(row.count, maxCount)}%` }}
                          />
                        </div>
                      </div>
                    </Fragment>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
