'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@open-story/ui/components/badge';
import { Button } from '@open-story/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@open-story/ui/components/card';
import { Skeleton } from '@open-story/ui/components/skeleton';
import Link from 'next/link';
import { ArrowRight, CalendarClock, Layers3, PencilLine, Plus, Shapes } from 'lucide-react';
import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/admin/page-header';
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
  return new Intl.DateTimeFormat('tr-TR', {
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
    <div className="grid gap-4 xl:grid-cols-2">
      {Array.from({ length: 2 }).map((_, index) => (
        <Card key={index} className="border-border/60 bg-card/80">
          <CardHeader className="space-y-4">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="grid gap-3 border-t border-border/60 pt-6 sm:grid-cols-2">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
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
            placementKey: 'Bu placement_key zaten kullanımda.',
          },
        };
      }

      setSubmitError(error instanceof Error ? error.message : 'Placement kaydedilemedi.');
      return undefined;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Button className="gap-2" onClick={openCreateSheet}>
              <Plus className="h-4 w-4" />
              Yeni placement
            </Button>
            <Button asChild variant="outline">
              <Link href="/">
                Dashboard&apos;a dön
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </>
        }
        description="Placement ekranı story bar yüzeylerinin sabit giriş noktalarını yönetir. Create ve edit aksiyonları artık doğrudan backend API üzerinden kalıcı sqlite storage'a yazılır."
        eyebrow="Placements"
        title="Placement yönetim ekranı"
      />

      <section className="space-y-4">
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/80 p-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Body</p>
            <h2 className="text-xl font-semibold tracking-tight">Tanımlı placement&apos;lar</h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Her kart aynı surface için operasyonel adı, `placement_key` bilgisini ve güncel
              düzenleme aksiyonunu taşır.
            </p>
          </div>

          <Badge className="w-fit" variant="secondary">
            {placements.length} placement
          </Badge>
        </div>

        {placementsQuery.isLoading ? (
          <LoadingState />
        ) : placementsQuery.isError ? (
          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle>Placement listesi yüklenemedi</CardTitle>
              <CardDescription>
                {(placementsQuery.error as Error | undefined)?.message ??
                  'API yanıtı alınamadı. Backend servisinin çalıştığını kontrol edin.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => placementsQuery.refetch()} variant="outline">
                Tekrar dene
              </Button>
            </CardContent>
          </Card>
        ) : placements.length === 0 ? (
          <Card className="border-border/60 border-dashed bg-card/80">
            <CardHeader className="items-start text-left">
              <div className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
                <Layers3 className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl">Henüz placement tanımı yok</CardTitle>
              <CardDescription className="max-w-xl leading-6">
                Story bar feed çözümlemesi placement üzerinden başladığı için ilk adım olarak en az
                bir placement oluşturun. Create akışı sağdaki sheet içinde açılır.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="gap-2" onClick={openCreateSheet}>
                <Plus className="h-4 w-4" />
                İlk placement&apos;ı oluştur
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {placements.map((placement) => (
              <Card key={placement.id} className="border-border/60 bg-card/80 transition-colors hover:bg-card">
                <CardHeader className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-3">
                      <div className="inline-flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
                        <Shapes className="h-5 w-5" />
                      </div>
                      <div className="space-y-2">
                        <CardTitle className="text-xl">{placement.name}</CardTitle>
                        <CardDescription className="leading-6">
                          {placement.description ?? 'Açıklama girilmedi.'}
                        </CardDescription>
                      </div>
                    </div>

                    <Button
                      className="gap-2"
                      onClick={() => openEditSheet(placement.id)}
                      size="sm"
                      variant="outline"
                    >
                      <PencilLine className="h-4 w-4" />
                      Edit
                    </Button>
                  </div>

                  <Badge className="w-fit uppercase tracking-[0.16em]" variant="secondary">
                    {placement.placementKey}
                  </Badge>
                </CardHeader>

                <CardContent className="grid gap-3 border-t border-border/60 pt-6 text-sm sm:grid-cols-2">
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Bağlı Story Bar</p>
                    <p className="mt-3 text-2xl font-semibold">{placement.connectedSetCount}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Placement üstünde aktif olarak düzenlenen Story Bar sayısı.
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      <CalendarClock className="h-4 w-4" />
                      Son güncelleme
                    </div>
                    <p className="mt-3 text-2xl font-semibold">{formatDate(placement.updatedAt)}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Oluşturulma: {formatDate(placement.createdAt)}
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
