'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@open-story/ui/components/badge';
import { Button } from '@open-story/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@open-story/ui/components/card';
import { Skeleton } from '@open-story/ui/components/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@open-story/ui/components/table';
import Link from 'next/link';
import { Archive, ArrowRight, CalendarClock, CheckCircle2, CircleSlash, ListFilter, Plus, SquareStack } from 'lucide-react';
import { ReactNode, useMemo, useState } from 'react';

import { PageHeader } from '@/components/admin/page-header';
import {
  StoryGroupFormSubmitResult,
  StoryGroupFormSubmitValues,
  StoryGroupFormValues,
} from '@/components/admin/story-group-form';
import { StoryGroupSheet } from '@/components/admin/story-group-sheet';
import { ApiRequestError, apiRequest } from '@/lib/api';

type StoryGroupSetApiRecord = {
  id: string;
  name: string;
};

type StoryGroupApiRecord = {
  id: string;
  name: string;
  currentDraftRevisionId: string;
  currentPublishedRevisionId: string | null;
  logoAssetId: string;
  badge: {
    type: 'emoji' | 'svg';
    value: string;
  } | null;
  storyIds: string[];
  storyCount: number;
  archiveState: 'active' | 'archived';
  publishState: 'published' | 'unpublished';
  archivedAt: string | null;
  storyGroupSets: Array<{
    id: string;
    name: string;
    placementId: string;
    isFallback: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
};

type WorkspaceData = {
  storyGroups: StoryGroupApiRecord[];
  storyGroupSets: StoryGroupSetApiRecord[];
};

type ArchiveFilterValue = 'all' | 'active' | 'archived';
type PublishFilterValue = 'all' | 'published' | 'unpublished';

const emptyStoryGroups: StoryGroupApiRecord[] = [];
const emptyStoryGroupSets: StoryGroupSetApiRecord[] = [];
const emptyStoryGroupFormValues: StoryGroupFormValues = {
  name: '',
  logoAssetId: '',
  badgeType: 'none',
  badgeValue: '',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <select
        className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {children}
      </select>
    </label>
  );
}

function LoadingState() {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="space-y-4">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-4 w-72" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

function StateBadge({
  type,
  value,
}: {
  type: 'archive' | 'publish';
  value: 'active' | 'archived' | 'published' | 'unpublished';
}) {
  if (type === 'archive') {
    return (
      <Badge variant={value === 'archived' ? 'secondary' : 'outline'}>
        {value === 'archived' ? 'Archived' : 'Active'}
      </Badge>
    );
  }

  return (
    <Badge variant={value === 'published' ? 'default' : 'outline'}>
      {value === 'published' ? 'Published' : 'Unpublished'}
    </Badge>
  );
}

export function StoryGroupsWorkspace() {
  const queryClient = useQueryClient();
  const [selectedStoryGroupSetId, setSelectedStoryGroupSetId] = useState('all');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilterValue>('all');
  const [publishFilter, setPublishFilter] = useState<PublishFilterValue>('all');
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const workspaceQuery = useQuery({
    queryKey: ['story-groups-workspace'],
    queryFn: async (): Promise<WorkspaceData> => {
      const [storyGroups, storyGroupSets] = await Promise.all([
        apiRequest<StoryGroupApiRecord[]>('/api/story-groups'),
        apiRequest<StoryGroupSetApiRecord[]>('/api/story-group-sets'),
      ]);

      return {
        storyGroups,
        storyGroupSets,
      };
    },
  });

  const storyGroups = workspaceQuery.data?.storyGroups ?? emptyStoryGroups;
  const storyGroupSets = workspaceQuery.data?.storyGroupSets ?? emptyStoryGroupSets;
  const storyGroupSetOptions = useMemo(
    () => [...storyGroupSets].sort((left, right) => left.name.localeCompare(right.name, 'tr')),
    [storyGroupSets],
  );

  const filteredStoryGroups = useMemo(() => {
    return storyGroups.filter((storyGroup) => {
      if (
        selectedStoryGroupSetId !== 'all' &&
        !storyGroup.storyGroupSets.some((storyGroupSet) => storyGroupSet.id === selectedStoryGroupSetId)
      ) {
        return false;
      }

      if (archiveFilter !== 'all' && storyGroup.archiveState !== archiveFilter) {
        return false;
      }

      if (publishFilter !== 'all' && storyGroup.publishState !== publishFilter) {
        return false;
      }

      return true;
    });
  }, [archiveFilter, publishFilter, selectedStoryGroupSetId, storyGroups]);

  const archiveCount = useMemo(
    () => storyGroups.filter((storyGroup) => storyGroup.archiveState === 'archived').length,
    [storyGroups],
  );
  const publishedCount = useMemo(
    () => storyGroups.filter((storyGroup) => storyGroup.publishState === 'published').length,
    [storyGroups],
  );
  const sharedReferenceCount = useMemo(
    () => storyGroups.filter((storyGroup) => storyGroup.storyGroupSets.length > 1).length,
    [storyGroups],
  );

  const hasActiveFilters =
    selectedStoryGroupSetId !== 'all' || archiveFilter !== 'all' || publishFilter !== 'all';

  const resetFilters = () => {
    setSelectedStoryGroupSetId('all');
    setArchiveFilter('all');
    setPublishFilter('all');
  };

  const createStoryGroupMutation = useMutation({
    mutationFn: (values: StoryGroupFormSubmitValues) =>
      apiRequest<StoryGroupApiRecord>('/api/story-groups', {
        method: 'POST',
        body: JSON.stringify(values),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['story-groups-workspace'] });
      handleCreateSheetChange(false);
    },
  });

  const handleCreateSheetChange = (open: boolean) => {
    setIsCreateSheetOpen(open);

    if (!open) {
      setSubmitError(null);
    }
  };

  const openCreateSheet = () => {
    setSubmitError(null);
    setIsCreateSheetOpen(true);
  };

  const handleSubmitStoryGroup = async (
    values: StoryGroupFormSubmitValues,
  ): Promise<StoryGroupFormSubmitResult> => {
    setSubmitError(null);

    try {
      await createStoryGroupMutation.mutateAsync(values);
      return undefined;
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === 'validation_error') {
        if (error.message.includes('logo')) {
          return {
            fieldErrors: {
              logoAssetId: error.message,
            },
          };
        }

        if (error.message.includes('badge')) {
          return {
            fieldErrors: {
              badgeValue: error.message,
            },
          };
        }
      }

      setSubmitError(error instanceof Error ? error.message : 'Story Group oluşturulamadı.');
      return undefined;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Button asChild variant="outline">
            <Link href="/story-group-sets">
              Story Group Sets
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
        description="Story Groups ekranı paylaşımlı group root kayıtlarını tablo üzerinden izler. Liste, set referanslarını ve archive / publish durumlarını aynı yüzeyde filtrelemeye odaklanır."
        eyebrow="Story Groups"
        title="Group listesi ve lifecycle filtreleri"
      />

      <section className="space-y-4">
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/80 p-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Body</p>
            <h2 className="text-xl font-semibold tracking-tight">Tanımlı Story Group&apos;lar</h2>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Story Group sayısı arttığında kart düzeni yerine tablo kullanılır. Her satır group&apos;un
              hangi setlerde referanslandığını ve canlıya çıkıp çıkmadığını tek bakışta gösterir.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button className="gap-2" onClick={openCreateSheet}>
              <Plus className="h-4 w-4" />
              Yeni Story Group
            </Button>
            <Badge variant="secondary">{storyGroups.length} group</Badge>
            <Badge variant="secondary">{publishedCount} published</Badge>
            <Badge variant="secondary">{archiveCount} archived</Badge>
            <Badge variant="secondary">{sharedReferenceCount} shared ref</Badge>
          </div>
        </div>

        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  <ListFilter className="h-4 w-4" />
                  Filters
                </div>
                <CardTitle>Listeyi daralt</CardTitle>
                <CardDescription>
                  Story Group Set referansı, archive durumu ve publish durumu birlikte filtrelenir.
                </CardDescription>
              </div>

              {hasActiveFilters ? (
                <Button onClick={resetFilters} size="sm" variant="outline">
                  Filtreleri temizle
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <FilterSelect label="Story Group Set" onChange={setSelectedStoryGroupSetId} value={selectedStoryGroupSetId}>
              <option value="all">Tüm setler</option>
              {storyGroupSetOptions.map((storyGroupSet) => (
                <option key={storyGroupSet.id} value={storyGroupSet.id}>
                  {storyGroupSet.name}
                </option>
              ))}
            </FilterSelect>

            <FilterSelect label="Archive State" onChange={(value) => setArchiveFilter(value as ArchiveFilterValue)} value={archiveFilter}>
              <option value="all">Tümü</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </FilterSelect>

            <FilterSelect label="Publish State" onChange={(value) => setPublishFilter(value as PublishFilterValue)} value={publishFilter}>
              <option value="all">Tümü</option>
              <option value="published">Published</option>
              <option value="unpublished">Unpublished</option>
            </FilterSelect>
          </CardContent>
        </Card>

        {workspaceQuery.isLoading ? (
          <LoadingState />
        ) : workspaceQuery.isError ? (
          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle>Story Group listesi yüklenemedi</CardTitle>
              <CardDescription>
                {(workspaceQuery.error as ApiRequestError | Error | undefined)?.message ??
                  'Admin-web route veya local storage erişimini kontrol edin.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => workspaceQuery.refetch()} variant="outline">
                Tekrar dene
              </Button>
            </CardContent>
          </Card>
        ) : storyGroups.length === 0 ? (
          <Card className="border-border/60 border-dashed bg-card/80">
            <CardHeader className="items-start text-left">
              <div className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
                <SquareStack className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl">Henüz Story Group kaydı yok</CardTitle>
              <CardDescription className="max-w-2xl leading-6">
                Bu ekran liste ve lifecycle görünümü için hazır. Group kayıtları geldikçe set referansı,
                archive durumu ve publish durumu tabloya yansıyacak.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="gap-2">
                <Link href="/story-group-sets">
                  Story Group Set ekranına git
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : filteredStoryGroups.length === 0 ? (
          <Card className="border-border/60 border-dashed bg-card/80">
            <CardHeader>
              <CardTitle>Filtrelerle eşleşen Story Group bulunamadı</CardTitle>
              <CardDescription>
                Seçili Story Group Set veya durum filtreleri altında sonuç kalmadı. Filtreleri temizleyip
                tekrar deneyin.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={resetFilters} variant="outline">
                Filtreleri temizle
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <CardTitle>Story Group tablosu</CardTitle>
                  <CardDescription>
                    {filteredStoryGroups.length} sonuç gösteriliyor. Publish durumu `current_published_revision_id`
                    varlığına göre, archive durumu ise archive kaydına göre türetilir.
                  </CardDescription>
                </div>

                <Badge variant="secondary">{filteredStoryGroups.length} görünür satır</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="border-b border-border/60">Group</TableHead>
                    <TableHead className="border-b border-border/60">Story Group Sets</TableHead>
                    <TableHead className="border-b border-border/60">Archive</TableHead>
                    <TableHead className="border-b border-border/60">Publish</TableHead>
                    <TableHead className="border-b border-border/60">Stories</TableHead>
                    <TableHead className="border-b border-border/60">Last Update</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStoryGroups.map((storyGroup) => (
                    <TableRow key={storyGroup.id} className="align-top">
                      <TableCell className="border-b border-border/60 py-4 align-top">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">{storyGroup.name}</p>
                              {storyGroup.badge ? (
                                <Badge variant="outline">
                                  {storyGroup.badge.type === 'emoji' ? storyGroup.badge.value : 'SVG badge'}
                                </Badge>
                              ) : null}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Draft rev: {storyGroup.currentDraftRevisionId}
                            </p>
                          </div>
                      </TableCell>

                      <TableCell className="border-b border-border/60 py-4 align-top">
                          {storyGroup.storyGroupSets.length === 0 ? (
                            <div className="space-y-2">
                              <Badge variant="outline">Set bağlantısı yok</Badge>
                              <p className="text-sm text-muted-foreground">Henüz herhangi bir sette referanslanmıyor.</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-2">
                                {storyGroup.storyGroupSets.map((storyGroupSet) => (
                                  <Badge key={storyGroupSet.id} variant={storyGroupSet.isFallback ? 'default' : 'outline'}>
                                    {storyGroupSet.name}
                                  </Badge>
                                ))}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {storyGroup.storyGroupSets.length} set içinde referanslanıyor.
                              </p>
                            </div>
                          )}
                      </TableCell>

                      <TableCell className="border-b border-border/60 py-4 align-top">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Archive className="h-4 w-4 text-muted-foreground" />
                              <StateBadge type="archive" value={storyGroup.archiveState} />
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {storyGroup.archiveState === 'archived' && storyGroup.archivedAt
                                ? `Archive tarihi: ${formatDate(storyGroup.archivedAt)}`
                                : storyGroup.archiveState === 'archived'
                                  ? 'Archive kaydı mevcut.'
                                  : 'Liste içinde aktif görünür.'}
                            </p>
                          </div>
                      </TableCell>

                      <TableCell className="border-b border-border/60 py-4 align-top">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              {storyGroup.publishState === 'published' ? (
                                <CheckCircle2 className="h-4 w-4 text-primary" />
                              ) : (
                                <CircleSlash className="h-4 w-4 text-muted-foreground" />
                              )}
                              <StateBadge type="publish" value={storyGroup.publishState} />
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {storyGroup.currentPublishedRevisionId
                                ? `Live rev: ${storyGroup.currentPublishedRevisionId}`
                                : 'Henüz published revision yok.'}
                            </p>
                          </div>
                      </TableCell>

                      <TableCell className="border-b border-border/60 py-4 align-top">
                          <div className="space-y-2">
                            <p className="text-xl font-semibold">{storyGroup.storyCount}</p>
                            <p className="text-sm text-muted-foreground">
                              Bu group altında bağlı story sayısı.
                            </p>
                          </div>
                      </TableCell>

                      <TableCell className="border-b border-border/60 py-4 align-top">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <CalendarClock className="h-4 w-4 text-muted-foreground" />
                              {formatDate(storyGroup.updatedAt)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Oluşturulma: {formatDate(storyGroup.createdAt)}
                            </p>
                          </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      <StoryGroupSheet
        generalError={submitError}
        initialValues={emptyStoryGroupFormValues}
        onOpenChange={handleCreateSheetChange}
        onSubmit={handleSubmitStoryGroup}
        open={isCreateSheetOpen}
      />
    </div>
  );
}
