'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@open-story/ui/components/badge';
import { Button } from '@open-story/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@open-story/ui/components/card';
import { Skeleton } from '@open-story/ui/components/skeleton';
import { BookOpen, CalendarClock, Copy, Layers, PencilLine, Plus, Shapes } from 'lucide-react';
import { useMemo, useState } from 'react';

import { PageHeader, PageHeaderActionButton } from '@/components/admin/page-header';
import { PlacementFormValues } from '@/components/admin/placement-form';
import { PlacementSheet } from '@/components/admin/placement-sheet';
import { ApiRequestError, apiRequest } from '@/lib/api';

type PlacementApiRecord = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  connectedSetCount?: number;
};

type PlacementRecord = {
  id: string;
  name: string;
  placementKey: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  connectedSetCount: number;
};

const emptyPlacementFormValues: PlacementFormValues = {
  name: '',
  placementKey: '',
  description: '',
};
const emptyPlacements: PlacementRecord[] = [];

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function mapPlacement(apiPlacement: PlacementApiRecord): PlacementRecord {
  return {
    id: apiPlacement.id,
    name: apiPlacement.name,
    placementKey: apiPlacement.key,
    description: apiPlacement.description,
    createdAt: apiPlacement.createdAt,
    updatedAt: apiPlacement.updatedAt,
    connectedSetCount: apiPlacement.connectedSetCount ?? 0,
  };
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-6">
      {Array.from({ length: 2 }).map((_, index) => (
        <Card key={index} className="rounded-2xl border-border/70 bg-card/80">
          <CardHeader className="flex flex-col gap-5 p-8">
            <Skeleton className="h-9 w-56 rounded-full" />
            <Skeleton className="h-12 w-72" />
            <Skeleton className="h-10 w-64" />
          </CardHeader>
          <CardContent className="grid gap-6 p-8 pt-0 md:grid-cols-2">
            <Skeleton className="h-44 w-full rounded-2xl" />
            <Skeleton className="h-44 w-full rounded-2xl" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function PlacementsWorkspace() {
  const queryClient = useQueryClient();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingPlacementId, setEditingPlacementId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const placementsQuery = useQuery({
    queryKey: ['placements'],
    queryFn: async () => {
      const placements = await apiRequest<PlacementApiRecord[]>('/api/placements');
      return placements.map(mapPlacement);
    },
  });

  const placements = placementsQuery.data ?? emptyPlacements;

  const editingPlacement = useMemo(
    () => placements.find((placement) => placement.id === editingPlacementId) ?? null,
    [editingPlacementId, placements],
  );

  const sheetMode = editingPlacement ? 'edit' : 'create';

  const sheetInitialValues: PlacementFormValues = editingPlacement
    ? {
        name: editingPlacement.name,
        placementKey: editingPlacement.placementKey,
        description: editingPlacement.description ?? '',
      }
    : emptyPlacementFormValues;

  const createPlacementMutation = useMutation({
    mutationFn: (values: PlacementFormValues) =>
      apiRequest<PlacementApiRecord>('/api/placements', {
        method: 'POST',
        body: JSON.stringify({
          key: values.placementKey.trim(),
          name: values.name.trim(),
          description: values.description?.trim() || undefined,
        }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['placements'] });
      handleSheetChange(false);
    },
  });

  const updatePlacementMutation = useMutation({
    mutationFn: ({ placementId, values }: { placementId: string; values: PlacementFormValues }) =>
      apiRequest<PlacementApiRecord>(`/api/placements/${placementId}`, {
        method: 'PUT',
        body: JSON.stringify({
          key: values.placementKey.trim(),
          name: values.name.trim(),
          description: values.description?.trim() || '',
        }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['placements'] });
      handleSheetChange(false);
    },
  });

  const openCreateSheet = () => {
    setSubmitError(null);
    setEditingPlacementId(null);
    setIsSheetOpen(true);
  };

  const openEditSheet = (placementId: string) => {
    setSubmitError(null);
    setEditingPlacementId(placementId);
    setIsSheetOpen(true);
  };

  const copyPlacementKey = async (placementKey: string) => {
    await navigator.clipboard?.writeText(placementKey);
  };

  const handleSheetChange = (open: boolean) => {
    setIsSheetOpen(open);

    if (!open) {
      setEditingPlacementId(null);
      setSubmitError(null);
    }
  };

  const handleSubmitPlacement = async (values: PlacementFormValues) => {
    setSubmitError(null);

    try {
      if (editingPlacement) {
        await updatePlacementMutation.mutateAsync({
          placementId: editingPlacement.id,
          values,
        });
      } else {
        await createPlacementMutation.mutateAsync(values);
      }

      return undefined;
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 409) {
        return {
          fieldErrors: {
            placementKey: 'This placement key is already in use.',
          },
        };
      }

      setSubmitError(error instanceof Error ? error.message : 'Placement could not be saved.');
      return undefined;
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        actions={
          <PageHeaderActionButton onClick={openCreateSheet}>
            <Plus aria-hidden data-icon="inline-start" />
            New placement
          </PageHeaderActionButton>
        }
        title="Placement Management"
      />

      <section>
        {placementsQuery.isLoading ? (
          <LoadingState />
        ) : placementsQuery.isError ? (
          <Card className="rounded-2xl border-border/70 bg-card/80">
            <CardHeader>
              <CardTitle>Placement list could not be loaded</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="rounded-[8px] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {(placementsQuery.error as Error | undefined)?.message ??
                  'Placement list cannot be fetched right now.'}
              </div>
              <Button onClick={() => placementsQuery.refetch()} variant="outline">
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : placements.length === 0 ? (
          <Card className="rounded-2xl border-border/70 border-dashed bg-card/80">
            <CardHeader className="items-start gap-4 text-left">
              <div className="inline-flex size-12 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                <Shapes className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl">No placement definitions yet</CardTitle>
            </CardHeader>
            <CardContent>
              <Button className="gap-2" onClick={openCreateSheet}>
                <Plus className="h-4 w-4" />
                Create the first placement
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-6">
            {placements.map((placement) => (
              <Card
                key={placement.id}
                className="group relative overflow-hidden rounded-2xl border-border/70 bg-card/80 shadow-sm backdrop-blur-xl transition-colors hover:bg-card/95"
              >
                <div className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-primary/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
                <CardHeader className="relative flex flex-col gap-8 p-6 md:p-8">
                  <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
                    <div className="flex min-w-0 flex-col gap-5">
                      <Badge className="w-fit gap-2 rounded-full border-border/70 bg-muted/50 px-4 py-1.5 uppercase tracking-[0.18em] text-muted-foreground" variant="outline">
                        <Layers aria-hidden className="size-3.5 text-primary" />
                        Global Placement
                      </Badge>

                      <div className="flex min-w-0 flex-col gap-5">
                        <CardTitle className="break-words text-4xl font-bold leading-tight tracking-tight text-foreground md:text-5xl">
                          {placement.name}
                        </CardTitle>
                        <div className="flex min-w-0 items-center gap-2">
                          <code className="min-w-0 truncate rounded-[8px] bg-muted/70 px-3 py-2 font-mono text-sm font-medium text-primary sm:text-base">
                            {placement.placementKey}
                          </code>
                          <Button
                            aria-label={`Copy ${placement.placementKey} key`}
                            className="shrink-0 text-muted-foreground hover:text-primary"
                            onClick={() => copyPlacementKey(placement.placementKey)}
                            size="icon"
                            type="button"
                            variant="ghost"
                          >
                            <Copy aria-hidden className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <Button
                      className="h-12 shrink-0 gap-2 rounded-xl border-border/80 bg-muted/45 px-5 hover:border-primary/70 hover:bg-muted/70 hover:text-primary"
                      onClick={() => openEditSheet(placement.id)}
                      variant="outline"
                    >
                      <PencilLine aria-hidden data-icon="inline-start" />
                      Edit Settings
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="relative grid gap-6 p-6 pt-0 md:grid-cols-2 md:p-8 md:pt-0">
                  <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-background/45 p-6">
                    <BookOpen aria-hidden className="absolute right-5 top-5 size-10 text-foreground/10" />
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Linked Story Bars</p>
                    <div className="mt-6 flex items-baseline gap-3">
                      <span className="text-6xl font-bold leading-none tracking-tight tabular-nums">
                        {placement.connectedSetCount}
                      </span>
                      <span className="text-lg font-medium text-primary">Active</span>
                    </div>
                    <p className="mt-4 text-base leading-7 text-muted-foreground">
                      Number of Story Bars under this placement.
                    </p>
                  </div>

                  <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-background/45 p-6">
                    <CalendarClock aria-hidden className="absolute right-5 top-5 size-10 text-foreground/10" />
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Last Update</p>
                    <p className="mt-6 text-3xl font-bold tracking-tight text-foreground">
                      {formatDate(placement.updatedAt)}
                    </p>
                    <p className="mt-4 text-base leading-7 text-muted-foreground">
                      Created: {formatDate(placement.createdAt)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <PlacementSheet
        generalError={submitError}
        initialValues={sheetInitialValues}
        mode={sheetMode}
        onOpenChange={handleSheetChange}
        onSubmit={handleSubmitPlacement}
        open={isSheetOpen}
      />
    </div>
  );
}
