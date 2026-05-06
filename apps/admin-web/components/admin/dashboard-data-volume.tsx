import { Badge } from '@open-story/ui/components/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@open-story/ui/components/card';
import {
  Clapperboard,
  HardDriveDownload,
  Layers,
  type LucideIcon,
  SquareStack,
} from 'lucide-react';

import { formatMetricCount } from '@/lib/database-settings-presentation';
import type {
  DashboardDataVolumeCard,
  DashboardDataVolumeSnapshot,
} from '@/lib/server/dashboard-data-volume';

const contentCardIcons: Record<DashboardDataVolumeCard['key'], LucideIcon> = {
  'story-bars': Layers,
  'story-groups': SquareStack,
  stories: Clapperboard,
  assets: HardDriveDownload,
};

function getCardStat(card: DashboardDataVolumeCard, label: string): number {
  return card.stats.find((stat) => stat.label === label)?.value ?? 0;
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
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage ?? 'Database snapshot su anda yuklenemiyor.'}
          </div>
        </CardContent>
      </Card>
    );
  }

  const { contentCards, placementsCount } = snapshot;
  const storyBarsCard = contentCards.find((card) => card.key === 'story-bars') ?? null;
  const storyGroupsCard = contentCards.find((card) => card.key === 'story-groups') ?? null;
  const storiesCard = contentCards.find((card) => card.key === 'stories') ?? null;
  const assetsCard = contentCards.find((card) => card.key === 'assets') ?? null;

  const executiveStats = [
    {
      label: 'Placements',
      value: placementsCount,
    },
    {
      label: 'Live Story Bars',
      value: storyBarsCard ? getCardStat(storyBarsCard, 'Active') : 0,
    },
    {
      label: 'Published Groups',
      value: storyGroupsCard ? getCardStat(storyGroupsCard, 'Published') : 0,
    },
    {
      label: 'Published Stories',
      value: storiesCard ? getCardStat(storiesCard, 'Published') : 0,
    },
    {
      label: 'Video Assets',
      value: assetsCard ? getCardStat(assetsCard, 'Video') : 0,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <section className="grid gap-4">
        <Card className="border-border/60 bg-gradient-to-br from-card via-card to-muted/30">
          <CardContent className="flex flex-col gap-4 p-6">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {executiveStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-border/60 bg-background/70 p-4"
                >
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{stat.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
                    {formatMetricCount(stat.value)}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {contentCards.map((card) => {
                const Icon = contentCardIcons[card.key];

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
    </div>
  );
}
