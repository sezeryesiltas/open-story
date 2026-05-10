'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@open-story/ui/components/badge';
import { Button } from '@open-story/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@open-story/ui/components/card';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@open-story/ui/components/tooltip';
import { cn } from '@open-story/ui/lib/utils';
import {
  Archive,
  CalendarClock,
  CheckCircle2,
  CircleSlash,
  Copy,
  GripVertical,
  ListFilter,
  MoreHorizontal,
  PencilLine,
  Plus,
  SquareStack,
} from 'lucide-react';
import { type DragEvent, useMemo, useState } from 'react';

import { PageHeader, PageHeaderActionButton } from '@/components/admin/page-header';
import { RecordId } from '@/components/admin/record-id';
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
  groupIds: string[];
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
const emptyAssetRecords: AssetApiRecord[] = [];
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
        {value === 'archived' ? 'Arşivde' : 'Aktif'}
      </Badge>
    );
  }

  return (
    <Badge variant={value === 'published' ? 'default' : 'outline'}>
      {value === 'published' ? 'Yayında' : 'Yayında değil'}
    </Badge>
  );
}

function hasUnpublishedChanges(storyGroup: StoryGroupApiRecord): boolean {
  return Boolean(
    storyGroup.currentPublishedRevisionId &&
      storyGroup.currentPublishedRevisionId !== storyGroup.currentDraftRevisionId,
  );
}

function canPublish(storyGroup: StoryGroupApiRecord): boolean {
  return !storyGroup.currentPublishedRevisionId || hasUnpublishedChanges(storyGroup);
}

function publishActionLabel(storyGroup: StoryGroupApiRecord): string {
  if (storyGroup.archiveState === 'archived') {
    return 'Restore to publish';
  }

  if (!storyGroup.currentPublishedRevisionId) {
    return 'Publish';
  }

  return hasUnpublishedChanges(storyGroup) ? 'Republish' : 'Already published';
}

function StoryGroupStats({
  totalCount,
  publishedCount,
  pendingChangesCount,
  archiveCount,
  sharedReferenceCount,
}: {
  totalCount: number;
  publishedCount: number;
  pendingChangesCount: number;
  archiveCount: number;
  sharedReferenceCount: number;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Card className="border-border/60 bg-card/80">
        <CardHeader className="pb-2">
          <p className="text-sm font-medium text-muted-foreground">Toplam</p>
          <CardTitle className="text-2xl">{totalCount}</CardTitle>
        </CardHeader>
      </Card>
      <Card className="border-border/60 bg-card/80">
        <CardHeader className="pb-2">
          <p className="text-sm font-medium text-muted-foreground">Yayında</p>
          <CardTitle className="text-2xl">{publishedCount}</CardTitle>
        </CardHeader>
      </Card>
      <Card className="border-border/60 bg-card/80">
        <CardHeader className="pb-2">
          <p className="text-sm font-medium text-muted-foreground">Taslak değişiklik</p>
          <CardTitle className="text-2xl">{pendingChangesCount}</CardTitle>
        </CardHeader>
      </Card>
      <Card className="border-border/60 bg-card/80">
        <CardHeader className="pb-2">
          <p className="text-sm font-medium text-muted-foreground">Arşivde</p>
          <CardTitle className="text-2xl">{archiveCount}</CardTitle>
        </CardHeader>
      </Card>
      <Card className="border-border/60 bg-card/80">
        <CardHeader className="pb-2">
          <p className="text-sm font-medium text-muted-foreground">Çoklu kullanım</p>
          <CardTitle className="text-2xl">{sharedReferenceCount}</CardTitle>
        </CardHeader>
      </Card>
    </div>
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
  const [draggedStoryGroupId, setDraggedStoryGroupId] = useState<string | null>(null);
  const [dragOverStoryGroupId, setDragOverStoryGroupId] = useState<string | null>(null);
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
  const storyGroupSetOptions = useMemo(
    () => [...storyGroupSets].sort((left, right) => left.name.localeCompare(right.name, 'tr')),
    [storyGroupSets],
  );
  const selectedStoryGroupSet = useMemo(
    () => storyGroupSets.find((storyGroupSet) => storyGroupSet.id === selectedStoryGroupSetId) ?? null,
    [selectedStoryGroupSetId, storyGroupSets],
  );
  const canReorderStoryGroups = Boolean(selectedStoryGroupSet);
  const groupLogoAssetById = useMemo(
    () => new Map((workspaceQuery.data?.groupLogoAssets ?? emptyAssetRecords).map((asset) => [asset.id, asset])),
    [workspaceQuery.data?.groupLogoAssets],
  );

  const filteredStoryGroups = useMemo(() => {
    const nextStoryGroups = storyGroups.filter((storyGroup) => {
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

    if (!selectedStoryGroupSet) {
      return nextStoryGroups;
    }

    const groupOrder = new Map(selectedStoryGroupSet.groupIds.map((groupId, index) => [groupId, index]));
    return [...nextStoryGroups].sort(
      (left, right) =>
        (groupOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (groupOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER),
    );
  }, [archiveFilter, publishFilter, selectedStoryGroupSet, selectedStoryGroupSetId, storyGroups]);

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
  const pendingChangesCount = useMemo(
    () => storyGroups.filter((storyGroup) => hasUnpublishedChanges(storyGroup)).length,
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

  const reorderStoryGroupsMutation = useMutation({
    mutationFn: ({
      storyGroupSetId,
      groupIds,
    }: {
      storyGroupSetId: string;
      groupIds: string[];
    }) =>
      apiRequest<StoryGroupSetApiRecord>(`/api/story-group-sets/${storyGroupSetId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'reorder_story_groups',
          group_ids: groupIds,
        }),
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

  function buildNextStoryGroupSetOrder(activeId: string, overId: string): string[] | null {
    if (!selectedStoryGroupSet) {
      return null;
    }

    const visibleIds = filteredStoryGroups.map((storyGroup) => storyGroup.id);
    const activeIndex = visibleIds.indexOf(activeId);
    const overIndex = visibleIds.indexOf(overId);

    if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) {
      return null;
    }

    const reorderedVisibleIds = [...visibleIds];
    const [movedId] = reorderedVisibleIds.splice(activeIndex, 1);
    reorderedVisibleIds.splice(overIndex, 0, movedId);

    const visibleIdSet = new Set(visibleIds);
    let visibleIndex = 0;

    return selectedStoryGroupSet.groupIds.map((groupId) => {
      if (!visibleIdSet.has(groupId)) {
        return groupId;
      }

      const nextVisibleId = reorderedVisibleIds[visibleIndex];
      visibleIndex += 1;
      return nextVisibleId;
    });
  }

  const handleDragStart = (event: DragEvent<HTMLTableRowElement>, storyGroupId: string) => {
    if (!canReorderStoryGroups) {
      event.preventDefault();
      return;
    }

    setActionError(null);
    setDraggedStoryGroupId(storyGroupId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', storyGroupId);
  };

  const handleDragOver = (event: DragEvent<HTMLTableRowElement>, storyGroupId: string) => {
    if (!canReorderStoryGroups || !draggedStoryGroupId || draggedStoryGroupId === storyGroupId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverStoryGroupId(storyGroupId);
  };

  const handleDrop = async (event: DragEvent<HTMLTableRowElement>, storyGroupId: string) => {
    event.preventDefault();

    const activeId = draggedStoryGroupId ?? event.dataTransfer.getData('text/plain');
    setDraggedStoryGroupId(null);
    setDragOverStoryGroupId(null);

    if (!selectedStoryGroupSet || !activeId || activeId === storyGroupId) {
      return;
    }

    const nextGroupIds = buildNextStoryGroupSetOrder(activeId, storyGroupId);
    if (!nextGroupIds) {
      return;
    }

    try {
      await reorderStoryGroupsMutation.mutateAsync({
        storyGroupSetId: selectedStoryGroupSet.id,
        groupIds: nextGroupIds,
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Story Group sırası güncellenemedi.');
    }
  };

  const handleDragEnd = () => {
    setDraggedStoryGroupId(null);
    setDragOverStoryGroupId(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <PageHeaderActionButton onClick={openCreateSheet}>
            <Plus aria-hidden data-icon="inline-start" />
            Yeni Story Group
          </PageHeaderActionButton>
        }
        title="Story Group listesi"
      />

      <section className="space-y-4">
        <StoryGroupStats
          archiveCount={archiveCount}
          pendingChangesCount={pendingChangesCount}
          publishedCount={publishedCount}
          sharedReferenceCount={sharedReferenceCount}
          totalCount={storyGroups.length}
        />

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
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {(workspaceQuery.error as ApiRequestError | Error | undefined)?.message ??
                'Story Group listesi şu anda alınamıyor.'}
            </div>
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
            </CardHeader>
          </Card>
        ) : filteredStoryGroups.length === 0 ? (
          <Card className="border-border/60 border-dashed bg-card/80">
            <CardHeader>
              <CardTitle>Filtrelerle eşleşen Story Group bulunamadı</CardTitle>
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
                    Filtreler
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
                  {canReorderStoryGroups ? <Badge variant="outline">Sürükle-bırak sıralama açık</Badge> : null}
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

              <Table className="min-w-[980px] table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 border-b border-border/60">
                      <span className="sr-only">Sıra</span>
                    </TableHead>
                    <TableHead className="w-[28%] border-b border-border/60">Group</TableHead>
                    <TableHead className="w-[20%] border-b border-border/60">Story Bars</TableHead>
                    <TableHead className="w-[10%] border-b border-border/60">Archive</TableHead>
                    <TableHead className="w-[16%] border-b border-border/60">Publish</TableHead>
                    <TableHead className="w-[8%] border-b border-border/60">Stories</TableHead>
                    <TableHead className="w-[12%] border-b border-border/60">Last Update</TableHead>
                    <TableHead className="w-20 border-b border-border/60 text-right">Actions</TableHead>
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
                    const draftChangesPending = hasUnpublishedChanges(storyGroup);
                    const canPublishDraft = canPublish(storyGroup) && storyGroup.archiveState !== 'archived';
                    const publishLabel = publishActionLabel(storyGroup);
                    const isDragging = draggedStoryGroupId === storyGroup.id;
                    const isDragOver = dragOverStoryGroupId === storyGroup.id;

                    return (
                      <TableRow
                        className={cn(
                          'align-top',
                          canReorderStoryGroups ? 'cursor-grab active:cursor-grabbing' : undefined,
                          isDragging ? 'opacity-50' : undefined,
                          isDragOver ? 'bg-muted/40' : undefined,
                        )}
                        draggable={canReorderStoryGroups}
                        key={storyGroup.id}
                        onDragEnd={handleDragEnd}
                        onDragOver={(event) => handleDragOver(event, storyGroup.id)}
                        onDragStart={(event) => handleDragStart(event, storyGroup.id)}
                        onDrop={(event) => handleDrop(event, storyGroup.id)}
                      >
                        <TableCell className="border-b border-border/60 py-4 align-top">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  aria-label="Story Group sırasını değiştir"
                                  className="cursor-grab active:cursor-grabbing"
                                  disabled={!canReorderStoryGroups || reorderStoryGroupsMutation.isPending}
                                  size="icon"
                                  variant="ghost"
                                >
                                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {canReorderStoryGroups
                                  ? 'Bu Story Bar içindeki sırayı değiştirmek için satırı sürükleyin.'
                                  : 'Sıralama için önce spesifik bir Story Bar seçin.'}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="w-[28%] border-b border-border/60 py-4 align-top">
                          <div className="flex items-center gap-3">
                            <StoryGroupLogo
                              alt={groupLogoAsset?.name ?? storyGroup.name}
                              badgeLabel={badgeLabel}
                              bottomLabel={storyGroup.bottomLabel}
                              inactiveGradientRing
                              size="lg"
                              src={groupLogoAsset?.url}
                            />
                            <div className="flex flex-col gap-1">
                              <p className="font-semibold">{storyGroup.name}</p>
                              <RecordId label="Group ID" value={storyGroup.id} />
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="w-[20%] border-b border-border/60 py-4 align-top">
                          {storyGroup.storyGroupSets.length === 0 ? (
                            <Badge variant="outline">Story Bar bağlantısı yok</Badge>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {storyGroup.storyGroupSets.map((storyGroupSet) => (
                                <div
                                  className="flex max-w-80 flex-col gap-1 rounded-md border border-border/60 px-2.5 py-2"
                                  key={storyGroupSet.id}
                                >
                                  <Badge className="w-fit" variant={storyGroupSet.isFallback ? 'default' : 'outline'}>
                                    {storyGroupSet.name}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="w-[10%] border-b border-border/60 py-4 align-top">
                          <div className="flex items-center gap-2">
                            <Archive className="h-4 w-4 text-muted-foreground" />
                            <StateBadge type="archive" value={storyGroup.archiveState} />
                          </div>
                        </TableCell>

                        <TableCell className="w-[16%] border-b border-border/60 py-4 align-top">
                          <div className="flex flex-wrap items-center gap-2">
                            {storyGroup.publishState === 'published' ? (
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                            ) : (
                              <CircleSlash className="h-4 w-4 text-muted-foreground" />
                            )}
                            <StateBadge type="publish" value={storyGroup.publishState} />
                            {draftChangesPending ? <Badge variant="secondary">Taslak değişiklik var</Badge> : null}
                          </div>
                        </TableCell>

                        <TableCell className="w-[8%] border-b border-border/60 py-4 align-top">
                          <p className="text-xl font-semibold">{storyGroup.storyCount}</p>
                        </TableCell>

                        <TableCell className="w-[12%] border-b border-border/60 py-4 align-top">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <CalendarClock className="h-4 w-4 text-muted-foreground" />
                            {formatDate(storyGroup.updatedAt)}
                          </div>
                        </TableCell>

                        <TableCell className="w-20 border-b border-border/60 py-4 align-top text-right">
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
                                disabled={!canPublishDraft}
                                onSelect={() =>
                                  handleRowAction(storyGroup, 'publish')
                                }
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                {publishLabel}
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
