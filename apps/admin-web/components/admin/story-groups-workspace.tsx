'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@open-story/ui/components/badge';
import { Button } from '@open-story/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@open-story/ui/components/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@open-story/ui/components/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@open-story/ui/components/select';
import { Skeleton } from '@open-story/ui/components/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@open-story/ui/components/table';
import Link from 'next/link';
import {
  Archive,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleSlash,
  Copy,
  ListFilter,
  MoreHorizontal,
  PencilLine,
  Plus,
  SquareStack,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/admin/page-header';
import { StoryGroupLogo } from '@/components/admin/story-group-logo';
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

type AssetApiRecord = {
  id: string;
  url: string;
  name: string;
};

type StoryGroupApiRecord = {
  id: string;
  name: string;
  bottomLabel: string | null;
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
  groupLogoAssets: AssetApiRecord[];
};

type ArchiveFilterValue = 'all' | 'active' | 'archived';
type PublishFilterValue = 'all' | 'published' | 'unpublished';

const emptyStoryGroups: StoryGroupApiRecord[] = [];
const emptyStoryGroupSets: StoryGroupSetApiRecord[] = [];
const emptyStoryGroupFormValues: StoryGroupFormValues = {
  name: '',
  bottomLabel: '',
  logoAssetId: '',
  badgeType: 'none',
  badgeValue: '',
  storyGroupSetIds: [],
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
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{
    value: string;
    label: string;
  }>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <Select onValueChange={onChange} value={value}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
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
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilterValue>('active');
  const [publishFilter, setPublishFilter] = useState<PublishFilterValue>('all');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<'create' | 'edit' | 'copy'>('create');
  const [activeStoryGroupId, setActiveStoryGroupId] = useState<string | null>(null);
  const [sheetInitialValues, setSheetInitialValues] = useState<StoryGroupFormValues>(emptyStoryGroupFormValues);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const workspaceQuery = useQuery({
    queryKey: ['story-groups-workspace'],
    queryFn: async (): Promise<WorkspaceData> => {
      const [storyGroups, storyGroupSets, groupLogoAssets] = await Promise.all([
        apiRequest<StoryGroupApiRecord[]>('/api/story-groups'),
        apiRequest<StoryGroupSetApiRecord[]>('/api/story-group-sets'),
        apiRequest<AssetApiRecord[]>('/api/assets?type=group_logo'),
      ]);

      return {
        storyGroups,
        storyGroupSets,
        groupLogoAssets,
      };
    },
  });

  const storyGroups = workspaceQuery.data?.storyGroups ?? emptyStoryGroups;
  const storyGroupSets = workspaceQuery.data?.storyGroupSets ?? emptyStoryGroupSets;
  const groupLogoAssets = workspaceQuery.data?.groupLogoAssets ?? [];
  const storyGroupSetOptions = useMemo(
    () => [...storyGroupSets].sort((left, right) => left.name.localeCompare(right.name, 'tr')),
    [storyGroupSets],
  );
  const groupLogoAssetById = useMemo(
    () => new Map(groupLogoAssets.map((asset) => [asset.id, asset])),
    [groupLogoAssets],
  );

  const filteredStoryGroups = useMemo(() => {
    return storyGroups.filter((storyGroup) => {
      if (selectedStoryGroupSetId === 'unassigned') {
        if (storyGroup.storyGroupSets.length > 0) {
          return false;
        }
      } else if (
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
    selectedStoryGroupSetId !== 'all' || archiveFilter !== 'active' || publishFilter !== 'all';

  const resetFilters = () => {
    setSelectedStoryGroupSetId('all');
    setArchiveFilter('active');
    setPublishFilter('all');
  };

  const updateStoryGroupMutation = useMutation({
    mutationFn: ({
      storyGroupId,
      values,
    }: {
      storyGroupId: string;
      values: StoryGroupFormSubmitValues;
    }) =>
      apiRequest<StoryGroupApiRecord>(`/api/story-groups/${storyGroupId}`, {
        method: 'PUT',
        body: JSON.stringify(values),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['story-groups-workspace'] });
      handleSheetChange(false);
    },
  });

  const patchStoryGroupMutation = useMutation({
    mutationFn: ({
      storyGroupId,
      action,
    }: {
      storyGroupId: string;
      action: 'archive' | 'restore' | 'publish';
    }) =>
      apiRequest<StoryGroupApiRecord>(`/api/story-groups/${storyGroupId}`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['story-groups-workspace'] });
    },
  });

  const createStoryGroupMutation = useMutation({
    mutationFn: (values: StoryGroupFormSubmitValues) =>
      apiRequest<StoryGroupApiRecord>('/api/story-groups', {
        method: 'POST',
        body: JSON.stringify(values),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['story-groups-workspace'] });
      handleSheetChange(false);
    },
  });

  function toFormValues(storyGroup: StoryGroupApiRecord): StoryGroupFormValues {
    return {
      name: storyGroup.name,
      bottomLabel: storyGroup.bottomLabel ?? '',
      logoAssetId: storyGroup.logoAssetId,
      badgeType: storyGroup.badge?.type ?? 'none',
      badgeValue: storyGroup.badge?.value ?? '',
      storyGroupSetIds: storyGroup.storyGroupSets.map((storyGroupSet) => storyGroupSet.id),
    };
  }

  const handleSheetChange = (open: boolean) => {
    setIsSheetOpen(open);

    if (!open) {
      setSubmitError(null);
      setSheetMode('create');
      setActiveStoryGroupId(null);
      setSheetInitialValues(emptyStoryGroupFormValues);
    }
  };

  const openCreateSheet = () => {
    setSubmitError(null);
    setSheetMode('create');
    setActiveStoryGroupId(null);
    setSheetInitialValues(emptyStoryGroupFormValues);
    setIsSheetOpen(true);
  };

  const openEditSheet = (storyGroup: StoryGroupApiRecord) => {
    setSubmitError(null);
    setSheetMode('edit');
    setActiveStoryGroupId(storyGroup.id);
    setSheetInitialValues(toFormValues(storyGroup));
    setIsSheetOpen(true);
  };

  const openCopySheet = (storyGroup: StoryGroupApiRecord) => {
    setSubmitError(null);
    setSheetMode('copy');
    setActiveStoryGroupId(null);
    setSheetInitialValues({
      ...toFormValues(storyGroup),
      name: `${storyGroup.name} Copy`,
      storyGroupSetIds: [],
    });
    setIsSheetOpen(true);
  };

  const handleSubmitStoryGroup = async (
    values: StoryGroupFormSubmitValues,
  ): Promise<StoryGroupFormSubmitResult> => {
    setSubmitError(null);

    try {
      if (sheetMode === 'edit') {
        if (!activeStoryGroupId) {
          setSubmitError('Düzenlenecek Story Group bulunamadı. Listeyi yenileyin.');
          return undefined;
        }

        await updateStoryGroupMutation.mutateAsync({
          storyGroupId: activeStoryGroupId,
          values,
        });
      } else {
        await createStoryGroupMutation.mutateAsync(values);
      }

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

        if (error.message.includes('bottom')) {
          return {
            fieldErrors: {
              bottomLabel: error.message,
            },
          };
        }

        if (error.message.includes('Story Bar')) {
          return {
            fieldErrors: {
              storyGroupSetIds: error.message,
            },
          };
        }
      }

      setSubmitError(
        error instanceof Error
          ? error.message
          : sheetMode === 'edit'
            ? 'Story Group güncellenemedi.'
            : 'Story Group oluşturulamadı.',
      );
      return undefined;
    }
  };

  const handleRowAction = async (
    storyGroup: StoryGroupApiRecord,
    action: 'archive' | 'restore' | 'publish',
  ) => {
    setActionError(null);

    try {
      await patchStoryGroupMutation.mutateAsync({
        storyGroupId: storyGroup.id,
        action,
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Story Group aksiyonu uygulanamadı.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Button className="gap-2" onClick={openCreateSheet}>
              <Plus className="h-4 w-4" />
              Yeni Story Group
            </Button>
            <Button asChild variant="outline">
              <Link href="/story-group-sets">
                Story Bars
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </>
        }
        description="Story Groups ekranı paylaşımlı group root kayıtlarını tablo üzerinden izler. Liste, Story Bar referanslarını ve archive / publish durumlarını aynı yüzeyde filtrelemeye odaklanır."
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
            <Badge variant="secondary">{storyGroups.length} group</Badge>
            <Badge variant="secondary">{publishedCount} published</Badge>
            <Badge variant="secondary">{archiveCount} archived</Badge>
            <Badge variant="secondary">{sharedReferenceCount} shared ref</Badge>
          </div>
        </div>

        {actionError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm leading-6 text-destructive">
            {actionError}
          </div>
        ) : null}

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
                Bu ekran liste ve lifecycle görünümü için hazır. Group kayıtları geldikçe Story Bar referansı,
                archive durumu ve publish durumu tabloya yansıyacak.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="gap-2">
                <Link href="/story-group-sets">
                  Story Bar ekranına git
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
                Seçili Story Bar veya durum filtreleri altında sonuç kalmadı. Filtreleri temizleyip
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
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    <ListFilter className="h-4 w-4" />
                    Filters
                  </div>
                  <CardTitle>Story Group tablosu</CardTitle>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {hasActiveFilters ? (
                    <Button onClick={resetFilters} size="sm" variant="outline">
                      Filtreleri temizle
                    </Button>
                  ) : null}
                  <Badge variant="secondary">{filteredStoryGroups.length} görünür satır</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <FilterSelect
                  label="Story Bar"
                  onChange={setSelectedStoryGroupSetId}
                  options={[
                    { label: "Tüm Story Bar'lar", value: 'all' },
                    { label: 'Atanmamış grouplar', value: 'unassigned' },
                    ...storyGroupSetOptions.map((storyGroupSet) => ({
                      label: storyGroupSet.name,
                      value: storyGroupSet.id,
                    })),
                  ]}
                  value={selectedStoryGroupSetId}
                />

                <FilterSelect
                  label="Archive State"
                  onChange={(value) => setArchiveFilter(value as ArchiveFilterValue)}
                  options={[
                    { label: 'Tümü', value: 'all' },
                    { label: 'Active', value: 'active' },
                    { label: 'Archived', value: 'archived' },
                  ]}
                  value={archiveFilter}
                />

                <FilterSelect
                  label="Publish State"
                  onChange={(value) => setPublishFilter(value as PublishFilterValue)}
                  options={[
                    { label: 'Tümü', value: 'all' },
                    { label: 'Published', value: 'published' },
                    { label: 'Unpublished', value: 'unpublished' },
                  ]}
                  value={publishFilter}
                />
              </div>

              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="border-b border-border/60">Group</TableHead>
                    <TableHead className="border-b border-border/60">Story Bars</TableHead>
                    <TableHead className="border-b border-border/60">Archive</TableHead>
                    <TableHead className="border-b border-border/60">Publish</TableHead>
                    <TableHead className="border-b border-border/60">Stories</TableHead>
                    <TableHead className="border-b border-border/60">Last Update</TableHead>
                    <TableHead className="border-b border-border/60 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStoryGroups.map((storyGroup) => {
                    const groupLogoAsset = groupLogoAssetById.get(storyGroup.logoAssetId);
                    const badgeLabel =
                      storyGroup.badge?.type === 'emoji'
                        ? storyGroup.badge.value
                        : storyGroup.badge
                          ? 'SVG'
                          : null;

                    return (
                      <TableRow key={storyGroup.id} className="align-top">
                        <TableCell className="border-b border-border/60 py-4 align-top">
                          <div className="flex items-center gap-3">
                            <StoryGroupLogo
                              alt={groupLogoAsset?.name ?? storyGroup.name}
                              badgeLabel={badgeLabel}
                              bottomLabel={storyGroup.bottomLabel}
                              inactiveGradientRing
                              size="lg"
                              src={groupLogoAsset?.url}
                            />
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold">{storyGroup.name}</p>
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="border-b border-border/60 py-4 align-top">
                          {storyGroup.storyGroupSets.length === 0 ? (
                            <Badge variant="outline">Story Bar bağlantısı yok</Badge>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {storyGroup.storyGroupSets.map((storyGroupSet) => (
                                <Badge key={storyGroupSet.id} variant={storyGroupSet.isFallback ? 'default' : 'outline'}>
                                  {storyGroupSet.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="border-b border-border/60 py-4 align-top">
                          <div className="flex items-center gap-2">
                            <Archive className="h-4 w-4 text-muted-foreground" />
                            <StateBadge type="archive" value={storyGroup.archiveState} />
                          </div>
                        </TableCell>

                        <TableCell className="border-b border-border/60 py-4 align-top">
                          <div className="flex items-center gap-2">
                            {storyGroup.publishState === 'published' ? (
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                            ) : (
                              <CircleSlash className="h-4 w-4 text-muted-foreground" />
                            )}
                            <StateBadge type="publish" value={storyGroup.publishState} />
                          </div>
                        </TableCell>

                        <TableCell className="border-b border-border/60 py-4 align-top">
                          <p className="text-xl font-semibold">{storyGroup.storyCount}</p>
                        </TableCell>

                        <TableCell className="border-b border-border/60 py-4 align-top">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <CalendarClock className="h-4 w-4 text-muted-foreground" />
                            {formatDate(storyGroup.updatedAt)}
                          </div>
                        </TableCell>

                        <TableCell className="border-b border-border/60 py-4 align-top text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button className="ml-auto" size="icon" variant="ghost">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Story Group actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => openEditSheet(storyGroup)}>
                                <PencilLine className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => openCopySheet(storyGroup)}>
                                <Copy className="mr-2 h-4 w-4" />
                                Copy
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={() =>
                                  handleRowAction(
                                    storyGroup,
                                    storyGroup.archiveState === 'archived' ? 'restore' : 'archive',
                                  )
                                }
                              >
                                <Archive className="mr-2 h-4 w-4" />
                                {storyGroup.archiveState === 'archived' ? 'Restore' : 'Archive'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={storyGroup.publishState === 'published'}
                                onSelect={() =>
                                  handleRowAction(storyGroup, 'publish')
                                }
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                {storyGroup.publishState === 'published' ? 'Already published' : 'Publish'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      <StoryGroupSheet
        generalError={submitError}
        initialValues={sheetInitialValues}
        mode={sheetMode}
        onOpenChange={handleSheetChange}
        onSubmit={handleSubmitStoryGroup}
        open={isSheetOpen}
        storyGroupSetOptions={storyGroupSetOptions}
      />
    </div>
  );
}
