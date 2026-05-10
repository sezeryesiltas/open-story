import { Button } from '@open-story/ui/components/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@open-story/ui/components/card';
import { cn } from '@open-story/ui/lib/utils';
import {
  ArrowRight,
  Clapperboard,
  Images,
  Layers,
  Shapes,
  SquareStack,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

import { formatMetricCount } from '@/lib/database-settings-presentation';
import type {
  DashboardDataVolumeCard,
  DashboardDataVolumeSnapshot,
  DashboardDataVolumeStat,
} from '@/lib/server/dashboard-data-volume';

type MetricTone = 'teal' | 'purple' | 'pink' | 'yellow' | 'orange' | 'blue' | 'neutral';

type MetricToneClasses = {
  dot: string;
  icon: string;
  ring: string;
};

type DashboardGauge = {
  key: string;
  title: string;
  stats: DashboardDataVolumeStat[];
};

const chartCircumference = 226.19;

const metricToneClasses: Record<MetricTone, MetricToneClasses> = {
  teal: {
    dot: 'bg-[hsl(var(--metric-teal))]',
    icon: 'bg-[hsl(var(--metric-teal)_/_0.12)] text-[hsl(var(--metric-teal))]',
    ring: 'text-[hsl(var(--metric-teal))]',
  },
  purple: {
    dot: 'bg-[hsl(var(--metric-purple))]',
    icon: 'bg-[hsl(var(--metric-purple)_/_0.12)] text-[hsl(var(--metric-purple))]',
    ring: 'text-[hsl(var(--metric-purple))]',
  },
  pink: {
    dot: 'bg-[hsl(var(--metric-pink))]',
    icon: 'bg-[hsl(var(--metric-pink)_/_0.12)] text-[hsl(var(--metric-pink))]',
    ring: 'text-[hsl(var(--metric-pink))]',
  },
  yellow: {
    dot: 'bg-[hsl(var(--metric-yellow))]',
    icon: 'bg-[hsl(var(--metric-yellow)_/_0.12)] text-[hsl(var(--metric-yellow))]',
    ring: 'text-[hsl(var(--metric-yellow))]',
  },
  orange: {
    dot: 'bg-[hsl(var(--metric-orange))]',
    icon: 'bg-[hsl(var(--metric-orange)_/_0.12)] text-[hsl(var(--metric-orange))]',
    ring: 'text-[hsl(var(--metric-orange))]',
  },
  blue: {
    dot: 'bg-[hsl(var(--metric-blue))]',
    icon: 'bg-[hsl(var(--metric-blue)_/_0.12)] text-[hsl(var(--metric-blue))]',
    ring: 'text-[hsl(var(--metric-blue))]',
  },
  neutral: {
    dot: 'bg-[hsl(var(--metric-neutral))]',
    icon: 'bg-[hsl(var(--metric-neutral)_/_0.12)] text-[hsl(var(--metric-neutral))]',
    ring: 'text-[hsl(var(--metric-neutral))]',
  },
};

const contentCardMeta: Record<
  DashboardDataVolumeCard['key'],
  {
    href: string;
    icon: LucideIcon;
    primaryStatLabel: string;
    tone: MetricTone;
  }
> = {
  'story-bars': {
    href: '/story-group-sets',
    icon: Layers,
    primaryStatLabel: 'Active',
    tone: 'teal',
  },
  'story-groups': {
    href: '/story-groups',
    icon: SquareStack,
    primaryStatLabel: 'Published',
    tone: 'purple',
  },
  stories: {
    href: '/stories',
    icon: Clapperboard,
    primaryStatLabel: 'Published',
    tone: 'pink',
  },
  assets: {
    href: '/assets',
    icon: Images,
    primaryStatLabel: 'Image',
    tone: 'yellow',
  },
};

const contentCardDisplayOrder: DashboardDataVolumeCard['key'][] = [
  'assets',
  'story-bars',
  'story-groups',
  'stories',
];

function getCardStat(card: DashboardDataVolumeCard, label: string): number {
  return card.stats.find((stat) => stat.label === label)?.value ?? 0;
}

function orderContentCards(cards: DashboardDataVolumeCard[]): DashboardDataVolumeCard[] {
  const cardsByKey = new Map(cards.map((card) => [card.key, card]));

  return contentCardDisplayOrder.flatMap((key) => {
    const card = cardsByKey.get(key);
    return card ? [card] : [];
  });
}

function getChartTotal(card: DashboardDataVolumeCard): number {
  const statTotal = card.stats.reduce((total, stat) => total + stat.value, 0);

  return statTotal > 0 ? statTotal : card.total;
}

function getStatsTotal(stats: DashboardDataVolumeStat[]): number {
  return stats.reduce((total, stat) => total + stat.value, 0);
}

function buildCardGauge(card: DashboardDataVolumeCard, key: string, title: string, labels: string[]): DashboardGauge {
  return {
    key,
    title,
    stats: labels.map((label) => ({
      label,
      value: getCardStat(card, label),
    })),
  };
}

function getSplitGauges(card: DashboardDataVolumeCard): DashboardGauge[] | null {
  if (card.key !== 'story-groups' && card.key !== 'stories') {
    return null;
  }

  return [
    buildCardGauge(card, 'archive-state', 'Archive State', ['Archived', 'Active']),
    buildCardGauge(card, 'publish-state', 'Publish State', ['Published', 'Unpublished', 'Draft']),
  ];
}

function getStoryBarStatLabel(label: string): string {
  if (label === 'Active') {
    return 'Aktif';
  }

  if (label === 'Deactive') {
    return 'Pasif';
  }

  return label;
}

function getStatTone(cardKey: DashboardDataVolumeCard['key'], label: string): MetricTone {
  if (cardKey === 'story-bars') {
    return label === 'Active' ? 'teal' : 'neutral';
  }

  if (cardKey === 'assets') {
    return label === 'Video' ? 'yellow' : 'orange';
  }

  if (label === 'Published') {
    return cardKey === 'stories' ? 'pink' : 'purple';
  }

  if (label === 'Unpublished') {
    return cardKey === 'stories' ? 'purple' : 'pink';
  }

  if (label === 'Draft') {
    return 'yellow';
  }

  if (label === 'Active') {
    return cardKey === 'story-groups' ? 'blue' : 'teal';
  }

  return 'neutral';
}

function getRingProgress(total: number, value: number): number {
  if (total <= 0 || value <= 0) {
    return 0;
  }

  return Math.min(1, Math.max(0, value / total));
}

function MetricIcon({ icon: Icon, tone }: { icon: LucideIcon; tone: MetricTone }) {
  return (
    <div className={cn('flex size-10 items-center justify-center rounded-[8px]', metricToneClasses[tone].icon)}>
      <Icon aria-hidden className="size-5" />
    </div>
  );
}

function RingChart({
  total,
  value,
  tone,
}: {
  total: number;
  value: number;
  tone: MetricTone;
}) {
  const progress = getRingProgress(total, value);
  const dashOffset = chartCircumference * (1 - progress);

  return (
    <div className="relative size-36 shrink-0 sm:size-40">
      <svg aria-hidden className="size-full" viewBox="0 0 100 100">
        <circle
          className="text-foreground/5"
          cx="50"
          cy="50"
          fill="transparent"
          r="36"
          stroke="currentColor"
          strokeWidth="10"
        />
        <circle
          className={cn('origin-center -rotate-90 transition-[stroke-dashoffset]', metricToneClasses[tone].ring)}
          cx="50"
          cy="50"
          fill="transparent"
          r="36"
          stroke="currentColor"
          strokeDasharray={chartCircumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          strokeWidth="10"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">{formatMetricCount(total)}</span>
        <span className="text-xs text-muted-foreground">Toplam</span>
      </div>
    </div>
  );
}

function SegmentedRingChart({
  total,
  segments,
}: {
  total: number;
  segments: Array<{
    tone: MetricTone;
    value: number;
  }>;
}) {
  let cumulativeLength = 0;

  return (
    <div className="relative size-36 shrink-0 sm:size-40">
      <svg aria-hidden className="size-full" viewBox="0 0 100 100">
        <circle
          className="text-foreground/5"
          cx="50"
          cy="50"
          fill="transparent"
          r="36"
          stroke="currentColor"
          strokeWidth="10"
        />
        {total > 0
          ? segments
              .filter((segment) => segment.value > 0)
              .map((segment) => {
                const segmentLength = chartCircumference * getRingProgress(total, segment.value);
                const dashOffset = -cumulativeLength;
                cumulativeLength += segmentLength;

                return (
                  <circle
                    className={cn('origin-center -rotate-90 transition-[stroke-dashoffset]', metricToneClasses[segment.tone].ring)}
                    cx="50"
                    cy="50"
                    fill="transparent"
                    key={`${segment.tone}-${segment.value}`}
                    r="36"
                    stroke="currentColor"
                    strokeDasharray={`${segmentLength} ${chartCircumference - segmentLength}`}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="butt"
                    strokeWidth="10"
                  />
                );
              })
          : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">{formatMetricCount(total)}</span>
        <span className="text-xs text-muted-foreground">Toplam</span>
      </div>
    </div>
  );
}

function StatLegendItem({
  cardKey,
  stat,
}: {
  cardKey: DashboardDataVolumeCard['key'];
  stat: DashboardDataVolumeStat;
}) {
  const tone = getStatTone(cardKey, stat.label);
  const label = cardKey === 'story-bars' ? getStoryBarStatLabel(stat.label) : stat.label;

  return (
    <div className="flex min-w-0 items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn('size-2 shrink-0 rounded-full', metricToneClasses[tone].dot)} />
        <span className="truncate text-sm text-muted-foreground">{label}</span>
      </div>
      <span className="text-sm font-semibold tabular-nums">{formatMetricCount(stat.value)}</span>
    </div>
  );
}

function GaugeBlock({
  cardKey,
  gauge,
}: {
  cardKey: DashboardDataVolumeCard['key'];
  gauge: DashboardGauge;
}) {
  const total = getStatsTotal(gauge.stats);
  const segments = gauge.stats.map((stat) => ({
    tone: getStatTone(cardKey, stat.label),
    value: stat.value,
  }));

  return (
    <div className="flex min-w-0 flex-col items-center gap-4">
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">{gauge.title}</p>
      </div>

      <SegmentedRingChart total={total} segments={segments} />

      <div className="flex w-full min-w-0 flex-col gap-3">
        {gauge.stats.map((stat) => (
          <StatLegendItem cardKey={cardKey} key={`${gauge.key}-${stat.label}`} stat={stat} />
        ))}
      </div>
    </div>
  );
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
      <Card className="rounded-[8px] border-border/70 bg-card">
        <CardHeader>
          <CardTitle>Aktif veri hacmi okunamadı</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-[8px] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage ?? 'Database snapshot şu anda yüklenemiyor.'}
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
  const orderedContentCards = orderContentCards(contentCards);

  const executiveStats: Array<{
    caption: string;
    icon: LucideIcon;
    label: string;
    tone: MetricTone;
    value: number;
  }> = [
    {
      caption: 'Toplam',
      icon: Shapes,
      label: 'Placements',
      tone: 'teal',
      value: placementsCount,
    },
    {
      caption: 'Aktif',
      icon: Layers,
      label: 'Live Story Bars',
      tone: 'teal',
      value: storyBarsCard ? getCardStat(storyBarsCard, 'Active') : 0,
    },
    {
      caption: 'Toplam',
      icon: SquareStack,
      label: 'Published Groups',
      tone: 'purple',
      value: storyGroupsCard ? getCardStat(storyGroupsCard, 'Published') : 0,
    },
    {
      caption: 'Toplam',
      icon: Clapperboard,
      label: 'Published Stories',
      tone: 'pink',
      value: storiesCard ? getCardStat(storiesCard, 'Published') : 0,
    },
    {
      caption: 'Toplam',
      icon: Images,
      label: 'Video Assets',
      tone: 'yellow',
      value: assetsCard ? getCardStat(assetsCard, 'Video') : 0,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {executiveStats.map((stat) => (
          <Card className="rounded-[8px] border-border/70 bg-card/95 shadow-sm" key={stat.label}>
            <CardHeader className="p-6 pb-0">
              <MetricIcon icon={stat.icon} tone={stat.tone} />
            </CardHeader>
            <CardContent className="flex flex-col gap-2 p-6 pt-5">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-3xl font-semibold tracking-tight tabular-nums">{formatMetricCount(stat.value)}</p>
              <p className="text-xs text-muted-foreground">{stat.caption}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        {orderedContentCards.map((card) => {
          const meta = contentCardMeta[card.key];
          const primaryValue = getCardStat(card, meta.primaryStatLabel);
          const chartTotal = getChartTotal(card);
          const splitGauges = getSplitGauges(card);
          const headerTotal = splitGauges ? card.total : chartTotal;
          const assetSegments = [
            {
              tone: 'yellow' as const,
              value: getCardStat(card, 'Video'),
            },
            {
              tone: 'orange' as const,
              value: getCardStat(card, 'Image'),
            },
          ];

          return (
            <Card
              className={cn(
                'flex min-h-[23rem] flex-col rounded-[8px] border-border/70 bg-card/95 shadow-sm',
                splitGauges ? 'min-h-[31rem]' : undefined,
              )}
              key={card.key}
            >
              <CardHeader className="flex-row items-start justify-between gap-4 p-6 pb-0">
                <div className="flex min-w-0 items-center gap-3">
                  <MetricIcon icon={meta.icon} tone={meta.tone} />
                  <CardTitle className="truncate text-xl">{card.title}</CardTitle>
                </div>

                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Toplam</p>
                  <p className="text-2xl font-semibold tracking-tight tabular-nums">{formatMetricCount(headerTotal)}</p>
                </div>
              </CardHeader>

              <CardContent
                className={cn(
                  'flex flex-1 p-6',
                  splitGauges ? 'items-start' : 'flex-col items-center gap-8 sm:flex-row',
                )}
              >
                {splitGauges ? (
                  <div className="grid w-full gap-8 md:grid-cols-2">
                    {splitGauges.map((gauge) => (
                      <GaugeBlock cardKey={card.key} gauge={gauge} key={`${card.key}-${gauge.key}`} />
                    ))}
                  </div>
                ) : (
                  <>
                    {card.key === 'assets' ? (
                      <SegmentedRingChart total={chartTotal} segments={assetSegments} />
                    ) : (
                      <RingChart total={chartTotal} value={primaryValue} tone={meta.tone} />
                    )}

                    <div className="flex w-full min-w-0 flex-1 flex-col gap-3">
                      {card.stats.map((stat) => (
                        <StatLegendItem cardKey={card.key} key={`${card.key}-${stat.label}`} stat={stat} />
                      ))}
                    </div>
                  </>
                )}
              </CardContent>

              <CardFooter className="justify-end border-t border-border/60 p-6 pt-4">
                <Button asChild className="bg-muted/70 hover:bg-muted" size="sm" variant="secondary">
                  <Link href={meta.href}>
                    Tümünü Gör
                    <ArrowRight aria-hidden className="size-4" data-icon="inline-end" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
