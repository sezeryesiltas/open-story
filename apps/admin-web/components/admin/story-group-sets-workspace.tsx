'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@open-story/ui/components/badge';
import { Button } from '@open-story/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@open-story/ui/components/card';
import { Skeleton } from '@open-story/ui/components/skeleton';
import { cn } from '@open-story/ui/lib/utils';
import {
  CalendarClock,
  CheckCircle2,
  Layers,
  PencilLine,
  Plus,
  Shapes,
  SquareStack,
  Target,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  StoryGroupSetFormSubmitResult,
  StoryGroupSetFormValues,
  StoryGroupSetSubmitValues,
} from '@/components/admin/story-group-set-form';
import { StoryGroupSetSheet } from '@/components/admin/story-group-set-sheet';
import { PageHeader, PageHeaderActionButton } from '@/components/admin/page-header';
import { RecordId } from '@/components/admin/record-id';
import { ApiRequestError, apiRequest } from '@/lib/api';
import { formatMetricCount } from '@/lib/database-settings-presentation';

type PlacementApiRecord = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

type PlacementRecord = {
  id: string;
  name: string;
  placementKey: string;
};

type StoryGroupSetApiRecord = {
  id: string;
  name: string;
  placementId: string;
  isFallback: boolean;
  platformTargets: Array<{
    platform: 'ios' | 'android';
    minAppVersion: string;
  }>;
  userSegments: string[];
  groupIds: string[];
  currentDraftRevisionId: string;
  currentPublishedRevisionId: string | null;
  createdAt: string;
  updatedAt: string;
};

type WorkspaceData = {
  placements: PlacementRecord[];
  storyGroupSets: StoryGroupSetApiRecord[];
};

const emptyStoryGroupSetFormValues: StoryGroupSetFormValues = {
  name: '',
  placementId: '',
  isFallback: false,
  iosEnabled: false,
  iosMinAppVersion: '',
  androidEnabled: false,
  androidMinAppVersion: '',
  userSegmentsText: '',
};
const emptyPlacements: PlacementRecord[] = [];
const emptyStoryGroupSets: StoryGroupSetApiRecord[] = [];

type MetricTone = 'teal' | 'yellow';

const metricToneClasses: Record<MetricTone, string> = {
  teal: 'bg-[hsl(var(--metric-teal)_/_0.12)] text-[hsl(var(--metric-teal))]',
  yellow: 'bg-[hsl(var(--metric-yellow)_/_0.12)] text-[hsl(var(--metric-yellow))]',
};

function mapPlacement(apiPlacement: PlacementApiRecord): PlacementRecord {
  return {
    id: apiPlacement.id,
    name: apiPlacement.name,
    placementKey: apiPlacement.key,
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',

    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatPlatformTargetSummary(storyGroupSet: StoryGroupSetApiRecord): string {
  if (storyGroupSet.isFallback) {
    return 'Yedek Story Bar';
  }

  if (storyGroupSet.platformTargets.length === 0) {
    return 'Tüm platformlar';
  }

  return storyGroupSet.platformTargets
    .map((target) => `${target.platform.toUpperCase()} ≥ ${target.minAppVersion}`)
    .join(' • ');
}

function formatSegmentSummary(storyGroupSet: StoryGroupSetApiRecord): string {
  if (storyGroupSet.isFallback) {
    return 'Eşleşme olmadığında kullanılır.';
  }

  if (storyGroupSet.userSegments.length === 0) {
    return 'Tüm kullanıcılar';
  }

  return storyGroupSet.userSegments.join(', ');
}

function isPublished(storyGroupSet: StoryGroupSetApiRecord): boolean {
  return Boolean(storyGroupSet.currentPublishedRevisionId);
}

function hasUnpublishedChanges(storyGroupSet: StoryGroupSetApiRecord): boolean {
  return Boolean(
    storyGroupSet.currentPublishedRevisionId &&
      storyGroupSet.currentPublishedRevisionId !== storyGroupSet.currentDraftRevisionId,
  );
}

function canPublish(storyGroupSet: StoryGroupSetApiRecord): boolean {
  return !storyGroupSet.currentPublishedRevisionId || hasUnpublishedChanges(storyGroupSet);
}

function publishActionLabel(storyGroupSet: StoryGroupSetApiRecord): string {
  if (!storyGroupSet.currentPublishedRevisionId) {
    return 'Publish';
  }

  return hasUnpublishedChanges(storyGroupSet) ? 'Republish' : 'Already live';
}

function toFormValues(storyGroupSet: StoryGroupSetApiRecord | null): StoryGroupSetFormValues {
  if (!storyGroupSet) {
    return emptyStoryGroupSetFormValues;
  }

  const iosTarget = storyGroupSet.platformTargets.find((target) => target.platform === 'ios');
  const androidTarget = storyGroupSet.platformTargets.find((target) => target.platform === 'android');

  return {
    name: storyGroupSet.name,
    placementId: storyGroupSet.placementId,
    isFallback: storyGroupSet.isFallback,
    iosEnabled: Boolean(iosTarget),
    iosMinAppVersion: iosTarget?.minAppVersion ?? '',
    androidEnabled: Boolean(androidTarget),
    androidMinAppVersion: androidTarget?.minAppVersion ?? '',
    userSegmentsText: storyGroupSet.userSegments.join(', '),
  };
}

function LoadingState() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {Array.from({ length: 2 }).map((_, index) => (
        <Card key={index} className="border-border/60 bg-card/80">
          <CardHeader className="space-y-4">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="grid gap-3 border-t border-border/60 pt-6 sm:grid-cols-2">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StoryBarStats({
  storyBarCount,
  publishedCount,
  pendingChangesCount,
  placementsCount,
}: {
  storyBarCount: number;
  publishedCount: number;
  pendingChangesCount: number;
  placementsCount: number;
}) {
  const stats: Array<{
    caption: string;
    icon: LucideIcon;
    label: string;
    tone: MetricTone;
    value: number;
  }> = [
    {
      caption: 'Toplam',
      icon: Layers,
      label: 'Story Bars',
      tone: 'teal',
      value: storyBarCount,
    },
    {
      caption: 'Aktif',
      icon: CheckCircle2,
      label: 'Live',
      tone: 'teal',
      value: publishedCount,
    },
    {
      caption: 'Republish gerekli',
      icon: CalendarClock,
      label: 'Taslak değişiklik',
      tone: 'yellow',
      value: pendingChangesCount,
    },
    {
      caption: 'Toplam',
      icon: Shapes,
      label: 'Placements',
      tone: 'teal',
      value: placementsCount,
    },
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;

        return (
          <Card className="rounded-[8px] border-border/70 bg-card/95 shadow-sm" key={stat.label}>
            <CardHeader className="p-6 pb-0">
              <div className={cn('flex size-10 items-center justify-center rounded-[8px]', metricToneClasses[stat.tone])}>
                <Icon aria-hidden className="size-5" />
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 p-6 pt-5">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-3xl font-semibold tracking-tight tabular-nums">{formatMetricCount(stat.value)}</p>
              <p className="text-xs text-muted-foreground">{stat.caption}</p>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}

export function StoryGroupSetsWorkspace() {
  const queryClient = useQueryClient();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingStoryGroupSetId, setEditingStoryGroupSetId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const workspaceQuery = useQuery({
    queryKey: ['story-group-sets-workspace'],
    queryFn: async (): Promise<WorkspaceData> => {
      const [storyGroupSets, placements] = await Promise.all([
        apiRequest<StoryGroupSetApiRecord[]>('/api/story-group-sets'),
        apiRequest<PlacementApiRecord[]>('/api/placements'),
      ]);

      return {
        placements: placements.map(mapPlacement),
        storyGroupSets,
      };
    },
  });

  const placements = workspaceQuery.data?.placements ?? emptyPlacements;
  const storyGroupSets = workspaceQuery.data?.storyGroupSets ?? emptyStoryGroupSets;

  const editingStoryGroupSet = useMemo(
    () => storyGroupSets.find((storyGroupSet) => storyGroupSet.id === editingStoryGroupSetId) ?? null,
    [editingStoryGroupSetId, storyGroupSets],
  );

  const sheetMode = editingStoryGroupSet ? 'edit' : 'create';
  const sheetInitialValues = toFormValues(editingStoryGroupSet);

  const createStoryGroupSetMutation = useMutation({
    mutationFn: (values: StoryGroupSetSubmitValues) =>
      apiRequest<StoryGroupSetApiRecord>('/api/story-group-sets', {
        method: 'POST',
        body: JSON.stringify(values),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['story-group-sets-workspace'] });
      handleSheetChange(false);
    },
  });

  const updateStoryGroupSetMutation = useMutation({
    mutationFn: ({
      storyGroupSetId,
      values,
    }: {
      storyGroupSetId: string;
      values: StoryGroupSetSubmitValues;
    }) =>
      apiRequest<StoryGroupSetApiRecord>(`/api/story-group-sets/${storyGroupSetId}`, {
        method: 'PUT',
        body: JSON.stringify(values),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['story-group-sets-workspace'] });
      handleSheetChange(false);
    },
  });

  const patchStoryGroupSetMutation = useMutation({
    mutationFn: ({
      storyGroupSetId,
      action,
    }: {
      storyGroupSetId: string;
      action: 'publish';
    }) =>
      apiRequest<StoryGroupSetApiRecord>(`/api/story-group-sets/${storyGroupSetId}`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['story-group-sets-workspace'] });
    },
  });

  const openCreateSheet = () => {
    setSubmitError(null);
    setActionError(null);
    setEditingStoryGroupSetId(null);
    setIsSheetOpen(true);
  };

  const openEditSheet = (storyGroupSetId: string) => {
    setSubmitError(null);
    setActionError(null);
    setEditingStoryGroupSetId(storyGroupSetId);
    setIsSheetOpen(true);
  };

  const handleSheetChange = (open: boolean) => {
    setIsSheetOpen(open);

    if (!open) {
      setEditingStoryGroupSetId(null);
      setSubmitError(null);
    }
  };

  const handleRowAction = async (storyGroupSet: StoryGroupSetApiRecord, action: 'publish') => {
    setActionError(null);

    try {
      await patchStoryGroupSetMutation.mutateAsync({
        storyGroupSetId: storyGroupSet.id,
        action,
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Story Bar aksiyonu uygulanamadı.');
    }
  };

  const handleSubmitStoryGroupSet = async (
    values: StoryGroupSetSubmitValues,
  ): Promise<StoryGroupSetFormSubmitResult> => {
    setSubmitError(null);

    try {
      if (editingStoryGroupSet) {
        await updateStoryGroupSetMutation.mutateAsync({
          storyGroupSetId: editingStoryGroupSet.id,
          values,
        });
      } else {
        await createStoryGroupSetMutation.mutateAsync(values);
      }

      return undefined;
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === 'not_found') {
        return {
          fieldErrors: {
            placementId: 'Seçili placement artık bulunamıyor. Listeyi yenileyin.',
          },
        };
      }

      setSubmitError(error instanceof Error ? error.message : 'Story Bar kaydedilemedi.');
      return undefined;
    }
  };

  const placementById = new Map(placements.map((placement) => [placement.id, placement]));
  const placementOptions = placements.map((placement) => ({
    id: placement.id,
    name: placement.name,
    placementKey: placement.placementKey,
  }));
  const canCreateStoryGroupSet = placements.length > 0;
  const publishedCount = useMemo(
    () => storyGroupSets.filter((storyGroupSet) => isPublished(storyGroupSet)).length,
    [storyGroupSets],
  );
  const pendingChangesCount = useMemo(
    () => storyGroupSets.filter((storyGroupSet) => hasUnpublishedChanges(storyGroupSet)).length,
    [storyGroupSets],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        actions={
          <PageHeaderActionButton disabled={!canCreateStoryGroupSet} onClick={openCreateSheet}>
            <Plus aria-hidden data-icon="inline-start" />
            Yeni Story Bar
          </PageHeaderActionButton>
        }
        title="Story Bar listesi"
      />

      <section className="flex flex-col gap-4">
        <StoryBarStats
          pendingChangesCount={pendingChangesCount}
          placementsCount={placements.length}
          publishedCount={publishedCount}
          storyBarCount={storyGroupSets.length}
        />

        {actionError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm leading-6 text-destructive">
            {actionError}
          </div>
        ) : null}

        {workspaceQuery.isSuccess && !canCreateStoryGroupSet ? (
          <Card className="border-border/60 border-dashed bg-card/80">
            <CardHeader className="items-start text-left">
              <div className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
                <Shapes className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl">Önce placement oluşturulmalı</CardTitle>
            </CardHeader>
          </Card>
        ) : null}

        {workspaceQuery.isLoading ? (
          <LoadingState />
        ) : workspaceQuery.isError ? (
          <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Story Bar listesi yüklenemedi</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {(workspaceQuery.error as Error | undefined)?.message ??
                'Story Bar listesi şu anda alınamıyor.'}
            </div>
            <Button onClick={() => workspaceQuery.refetch()} variant="outline">
              Tekrar dene
            </Button>
            </CardContent>
          </Card>
        ) : !canCreateStoryGroupSet ? null : storyGroupSets.length === 0 ? (
          <Card className="border-border/60 border-dashed bg-card/80">
            <CardHeader className="items-start text-left">
              <div className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
                <Layers className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl">Henüz Story Bar tanımı yok</CardTitle>
            </CardHeader>
            <CardContent>
              <Button className="gap-2" onClick={openCreateSheet}>
                <Plus className="h-4 w-4" />
                İlk Story Bar&apos;ı oluştur
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-6">
            {storyGroupSets.map((storyGroupSet) => {
              const placement = placementById.get(storyGroupSet.placementId);
              const isLive = isPublished(storyGroupSet);
              const draftChangesPending = hasUnpublishedChanges(storyGroupSet);
              const canPublishDraft = canPublish(storyGroupSet);
              const publishLabel = publishActionLabel(storyGroupSet);

              return (
                <Card
                  key={storyGroupSet.id}
                  className="group relative overflow-hidden rounded-2xl border-border/70 bg-card/80 shadow-sm backdrop-blur-xl transition-colors hover:bg-card/95"
                >
                  <div className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-primary/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
                  <CardHeader className="relative flex flex-col gap-8 p-6 md:p-8">
                    <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
                      <div className="flex min-w-0 flex-col gap-5">
                        <div className="flex flex-wrap gap-2">
                          <Badge className="w-fit gap-2 rounded-full border-border/70 bg-muted/50 px-4 py-1.5 uppercase tracking-[0.18em] text-muted-foreground" variant="outline">
                            <Layers aria-hidden className="size-3.5 text-primary" />
                            Story Bar Set
                          </Badge>
                          <Badge className="w-fit rounded-full px-4 py-1.5" variant={storyGroupSet.isFallback ? 'default' : 'outline'}>
                            {storyGroupSet.isFallback ? 'Fallback' : 'Targeted'}
                          </Badge>
                          <Badge className="w-fit rounded-full px-4 py-1.5" variant={isLive ? 'default' : 'outline'}>
                            {isLive ? 'Live' : 'Draft'}
                          </Badge>
                          {draftChangesPending ? (
                            <Badge className="w-fit rounded-full px-4 py-1.5" variant="secondary">
                              Taslak değişiklik var
                            </Badge>
                          ) : null}
                        </div>

                        <div className="flex min-w-0 flex-col gap-5">
                          <CardTitle className="break-words text-4xl font-bold leading-tight tracking-tight text-foreground md:text-5xl">
                            {storyGroupSet.name}
                          </CardTitle>
                          <div className="flex min-w-0 flex-col gap-3">
                            <code className="w-fit max-w-full truncate rounded-[8px] bg-muted/70 px-3 py-2 font-mono text-sm font-medium text-primary sm:text-base">
                              {placement?.placementKey ?? 'missing_placement'}
                            </code>
                            <RecordId label="Group Set ID" value={storyGroupSet.id} />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 md:justify-end">
                        <Button
                          className="h-12 shrink-0 rounded-xl px-5"
                          disabled={!canPublishDraft}
                          onClick={() => handleRowAction(storyGroupSet, 'publish')}
                          variant={canPublishDraft ? 'default' : 'secondary'}
                        >
                          <CheckCircle2 aria-hidden data-icon="inline-start" />
                          {publishLabel}
                        </Button>
                        <Button
                          className="h-12 shrink-0 rounded-xl border-border/80 bg-muted/45 px-5 hover:border-primary/70 hover:bg-muted/70 hover:text-primary"
                          onClick={() => openEditSheet(storyGroupSet.id)}
                          variant="outline"
                        >
                          <PencilLine aria-hidden data-icon="inline-start" />
                          Edit Settings
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="relative grid gap-6 p-6 pt-0 md:grid-cols-2 md:p-8 md:pt-0 xl:grid-cols-4">
                    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-background/45 p-6">
                      <Target aria-hidden className="absolute right-5 top-5 size-10 text-foreground/10" />
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Platform
                      </p>
                      <p className="mt-6 break-words text-base font-semibold leading-7 text-foreground">
                        {formatPlatformTargetSummary(storyGroupSet)}
                      </p>
                      <p className="mt-4 text-sm leading-6 text-muted-foreground">
                        {storyGroupSet.platformTargets.length} aktif platform hedefi.
                      </p>
                    </div>

                    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-background/45 p-6">
                      <UsersRound aria-hidden className="absolute right-5 top-5 size-10 text-foreground/10" />
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Kitle
                      </p>
                      <p className="mt-6 break-words text-base font-semibold leading-7 text-foreground">
                        {formatSegmentSummary(storyGroupSet)}
                      </p>
                      <p className="mt-4 text-sm leading-6 text-muted-foreground">
                        {storyGroupSet.userSegments.length} segment kuralı.
                      </p>
                    </div>

                    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-background/45 p-6">
                      <SquareStack aria-hidden className="absolute right-5 top-5 size-10 text-foreground/10" />
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Bağlı Group
                      </p>
                      <div className="mt-6 flex items-baseline gap-3">
                        <span className="text-6xl font-bold leading-none tracking-tight tabular-nums">
                          {storyGroupSet.groupIds.length}
                        </span>
                        <span className="text-lg font-medium text-primary">Group</span>
                      </div>
                    </div>

                    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-background/45 p-6">
                      <CalendarClock aria-hidden className="absolute right-5 top-5 size-10 text-foreground/10" />
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Son güncelleme
                      </p>
                      <p className="mt-6 text-3xl font-bold tracking-tight text-foreground">
                        {formatDate(storyGroupSet.updatedAt)}
                      </p>
                      <p className="mt-4 text-sm leading-6 text-muted-foreground">
                        Oluşturulma: {formatDate(storyGroupSet.createdAt)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <StoryGroupSetSheet
        generalError={submitError}
        initialValues={sheetInitialValues}
        mode={sheetMode}
        onOpenChange={handleSheetChange}
        onSubmit={handleSubmitStoryGroupSet}
        open={isSheetOpen}
        placements={placementOptions}
      />
    </div>
  );
}
