'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@open-story/ui/components/badge';
import { Button } from '@open-story/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@open-story/ui/components/card';
import { Skeleton } from '@open-story/ui/components/skeleton';
import Link from 'next/link';
import { ArrowRight, CalendarClock, CheckCircle2, Layers3, PencilLine, Plus, SquareStack } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  StoryGroupSetFormSubmitResult,
  StoryGroupSetFormValues,
  StoryGroupSetSubmitValues,
} from '@/components/admin/story-group-set-form';
import { StoryGroupSetSheet } from '@/components/admin/story-group-set-sheet';
import { PageHeader } from '@/components/admin/page-header';
import { ApiRequestError, apiRequest } from '@/lib/api';

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
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Button className="gap-2" disabled={!canCreateStoryGroupSet} onClick={openCreateSheet}>
              <Plus className="h-4 w-4" />
              Yeni Story Bar
            </Button>
            <Button asChild variant="outline">
              <Link href="/placements">
                Placements
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </>
        }
        description="Story bar listelerini burada oluşturabilir ve düzenleyebilirsiniz."
        eyebrow="Story Bars"
        title="Story Bar listesi"
      />

      <section className="space-y-4">
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/80 p-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Body</p>
            <h2 className="text-xl font-semibold tracking-tight">Tanımlı Story Bar&apos;lar</h2>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Her kart Story Bar adını, bağlı placement&apos;ı ve seçili koşulları gösterir.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge className="w-fit" variant="secondary">
              {storyGroupSets.length} Story Bar
            </Badge>
            <Badge className="w-fit" variant="secondary">
              {publishedCount} live
            </Badge>
            <Badge className="w-fit" variant="secondary">
              {pendingChangesCount} taslak değişiklik
            </Badge>
            <Badge className="w-fit" variant="secondary">
              {placements.length} placement
            </Badge>
          </div>
        </div>

        {actionError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm leading-6 text-destructive">
            {actionError}
          </div>
        ) : null}

        {workspaceQuery.isSuccess && !canCreateStoryGroupSet ? (
          <Card className="border-border/60 border-dashed bg-card/80">
            <CardHeader className="items-start text-left">
              <div className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
                <Layers3 className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl">Önce placement oluşturulmalı</CardTitle>
              <CardDescription className="max-w-2xl leading-6">
                Story Bar eklemek için önce bir placement oluşturun.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="gap-2">
                <Link href="/placements">
                  Placement yönetimine git
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {workspaceQuery.isLoading ? (
          <LoadingState />
        ) : workspaceQuery.isError ? (
          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle>Story Bar listesi yüklenemedi</CardTitle>
              <CardDescription>
                {(workspaceQuery.error as Error | undefined)?.message ??
                  'Story Bar listesi şu anda alınamıyor.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => workspaceQuery.refetch()} variant="outline">
                Tekrar dene
              </Button>
            </CardContent>
          </Card>
        ) : !canCreateStoryGroupSet ? null : storyGroupSets.length === 0 ? (
          <Card className="border-border/60 border-dashed bg-card/80">
            <CardHeader className="items-start text-left">
              <div className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
                <SquareStack className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl">Henüz Story Bar tanımı yok</CardTitle>
              <CardDescription className="max-w-2xl leading-6">
                İlk Story Bar&apos;ı ekleyerek içeriğin hangi alanda gösterileceğini belirleyin.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="gap-2" onClick={openCreateSheet}>
                <Plus className="h-4 w-4" />
                İlk Story Bar&apos;ı oluştur
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {storyGroupSets.map((storyGroupSet) => {
              const placement = placementById.get(storyGroupSet.placementId);
              const isLive = isPublished(storyGroupSet);
              const draftChangesPending = hasUnpublishedChanges(storyGroupSet);
              const canPublishDraft = canPublish(storyGroupSet);
              const publishLabel = publishActionLabel(storyGroupSet);

              return (
                <Card
                  key={storyGroupSet.id}
                  className="border-border/60 bg-card/80 transition-colors hover:bg-card"
                >
                  <CardHeader className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-3">
                        <div className="inline-flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
                          <SquareStack className="h-5 w-5" />
                        </div>
                        <div className="space-y-2">
                          <CardTitle className="text-xl">{storyGroupSet.name}</CardTitle>
                          <CardDescription className="leading-6">
                            {placement ? `Placement: ${placement.name}` : 'Bağlı placement bulunamadı.'}
                          </CardDescription>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button
                          className="gap-2"
                          disabled={!canPublishDraft}
                          onClick={() => handleRowAction(storyGroupSet, 'publish')}
                          size="sm"
                          variant={canPublishDraft ? 'default' : 'secondary'}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {publishLabel}
                        </Button>
                        <Button
                          className="gap-2"
                          onClick={() => openEditSheet(storyGroupSet.id)}
                          size="sm"
                          variant="outline"
                        >
                          <PencilLine className="h-4 w-4" />
                          Edit
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge className="w-fit uppercase tracking-[0.16em]" variant="secondary">
                        {placement?.placementKey ?? 'missing_placement'}
                      </Badge>
                      <Badge className="w-fit" variant={storyGroupSet.isFallback ? 'default' : 'outline'}>
                        {storyGroupSet.isFallback ? 'Fallback' : 'Targeted'}
                      </Badge>
                      <Badge className="w-fit" variant={isLive ? 'default' : 'outline'}>
                        {isLive ? 'Live' : 'Draft'}
                      </Badge>
                      {draftChangesPending ? (
                        <Badge className="w-fit" variant="secondary">
                          Taslak değişiklik var
                        </Badge>
                      ) : null}
                    </div>
                  </CardHeader>

                  <CardContent className="grid gap-3 border-t border-border/60 pt-6 text-sm sm:grid-cols-2">
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Platform
                      </p>
                      <p className="mt-3 text-base font-semibold">{formatPlatformTargetSummary(storyGroupSet)}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {storyGroupSet.platformTargets.length} aktif platform hedefi.
                      </p>
                    </div>

                    <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Kitle
                      </p>
                      <p className="mt-3 text-base font-semibold">{formatSegmentSummary(storyGroupSet)}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {storyGroupSet.userSegments.length} segment kuralı.
                      </p>
                    </div>

                    <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Bağlı Group
                      </p>
                      <p className="mt-3 text-2xl font-semibold">{storyGroupSet.groupIds.length}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">Bu Story Bar&apos;da yer alan group sayısı.</p>
                    </div>

                    <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        <CalendarClock className="h-4 w-4" />
                        Son güncelleme
                      </div>
                      <p className="mt-3 text-2xl font-semibold">{formatDate(storyGroupSet.updatedAt)}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
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
