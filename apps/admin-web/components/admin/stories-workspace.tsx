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
import { Skeleton } from '@open-story/ui/components/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@open-story/ui/components/table';
import {
  Archive,
  CalendarClock,
  CheckCircle2,
  CircleSlash,
  Clapperboard,
  MoreHorizontal,
  PencilLine,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import {
  ADMIN_TABLE_PAGE_SIZE,
  AdminFilterSelect,
  AdminTablePanel,
} from '@/components/admin/admin-table-panel';
import {
  StoryFormSubmitResult,
  StoryFormSubmitValues,
  StoryFormValues,
} from '@/components/admin/story-form';
import { StorySheet } from '@/components/admin/story-sheet';
import { PageHeader, PageHeaderActionButton } from '@/components/admin/page-header';
import { ApiRequestError, apiRequest } from '@/lib/api';
import { formatMetricCount } from '@/lib/database-settings-presentation';

type StoryApiRecord = {
  id: string;
  name: string;
  currentDraftRevisionId: string;
  currentPublishedRevisionId: string | null;
  groupId: string;
  groupName: string;
  position: number | null;
  mediaType: 'image' | 'video';
  assetId: string;
  posterAssetId: string | null;
  imageDurationMs: number | null;
  cta: {
    label: string;
    type: 'url' | 'deeplink';
    value: string;
  } | null;
  archiveState: 'active' | 'archived';
  publishState: 'published' | 'unpublished';
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  canDelete: boolean;
};

type StoryGroupApiRecord = {
  id: string;
  name: string;
  storyCount: number;
  archiveState: 'active' | 'archived';
  publishState: 'published' | 'unpublished';
};

type AssetApiRecord = {
  id: string;
  type: 'group_logo' | 'story_image' | 'story_video' | 'story_poster';
  url: string;
  name: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  source: 'url' | 'upload' | 'cloud_upload';
  createdAt: string;
  updatedAt: string;
};

type WorkspaceData = {
  stories: StoryApiRecord[];
  storyGroups: StoryGroupApiRecord[];
  storyImages: AssetApiRecord[];
  storyVideos: AssetApiRecord[];
  storyPosters: AssetApiRecord[];
};

type MediaFilterValue = 'all' | 'image' | 'video';
type PublishFilterValue = 'all' | 'published' | 'unpublished';
type ArchiveFilterValue = 'all' | 'active' | 'archived';
type CtaFilterValue = 'all' | 'with_cta' | 'without_cta';

const emptyStories: StoryApiRecord[] = [];
const emptyStoryGroups: StoryGroupApiRecord[] = [];
const emptyStoryFormValues: StoryFormValues = {
  name: '',
  groupId: '',
  position: '1',
  mediaType: 'image',
  assetId: '',
  posterAssetId: '',
  imageDurationSeconds: '',
  hasCta: false,
  ctaLabel: '',
  ctaType: 'url',
  ctaValue: '',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatDurationLabel(story: StoryApiRecord): string {
  if (story.mediaType === 'video') {
    return 'Video süresi';
  }

  if (!story.imageDurationMs) {
    return 'Varsayılan 5 sn';
  }

  return `${Math.round(story.imageDurationMs / 1000)} sn`;
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

function StoryStats({
  totalCount,
  publishedCount,
  pendingChangesCount,
  archivedCount,
}: {
  totalCount: number;
  publishedCount: number;
  pendingChangesCount: number;
  archivedCount: number;
}) {
  const stats: Array<{
    icon: LucideIcon;
    label: string;
    unit: string;
    value: number;
  }> = [
    {
      icon: Clapperboard,
      label: 'Stories',
      unit: 'Story',
      value: totalCount,
    },
    {
      icon: CheckCircle2,
      label: 'Yayında',
      unit: 'Live',
      value: publishedCount,
    },
    {
      icon: CalendarClock,
      label: 'Taslak değişiklik',
      unit: 'Draft',
      value: pendingChangesCount,
    },
    {
      icon: Archive,
      label: 'Arşivde',
      unit: 'Archive',
      value: archivedCount,
    },
  ];

  return (
    <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;

        return (
          <div
            className="relative overflow-hidden rounded-2xl border border-border/60 bg-background/45 p-6"
            key={stat.label}
          >
            <Icon aria-hidden className="absolute right-5 top-5 size-10 text-foreground/10" />
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {stat.label}
            </p>
            <div className="mt-6 flex items-baseline gap-3">
              <span className="text-6xl font-bold leading-none tracking-tight tabular-nums">
                {formatMetricCount(stat.value)}
              </span>
              <span className="text-lg font-medium text-primary">{stat.unit}</span>
            </div>
          </div>
        );
      })}
    </section>
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

function hasUnpublishedChanges(story: StoryApiRecord): boolean {
  return Boolean(
    story.currentPublishedRevisionId &&
    story.currentPublishedRevisionId !== story.currentDraftRevisionId,
  );
}

function canPublish(story: StoryApiRecord): boolean {
  return !story.currentPublishedRevisionId || hasUnpublishedChanges(story);
}

function publishActionLabel(story: StoryApiRecord): string {
  if (story.archiveState === 'archived') {
    return 'Restore to publish';
  }

  if (!story.currentPublishedRevisionId) {
    return 'Publish';
  }

  return hasUnpublishedChanges(story) ? 'Republish' : 'Already published';
}

function StoryThumbnail({
  story,
  assetById,
}: {
  story: StoryApiRecord;
  assetById: Map<string, AssetApiRecord>;
}) {
  const mediaAsset = assetById.get(story.assetId);
  const posterAsset = story.posterAssetId ? assetById.get(story.posterAssetId) : null;
  const previewAsset = story.mediaType === 'image' ? mediaAsset : posterAsset;

  if (previewAsset && previewAsset.type !== 'story_video') {
    return (
      <div className="relative flex h-14 w-10 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-background">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={previewAsset.name}
          className="h-full w-full object-cover"
          src={previewAsset.url}
        />
        {story.mediaType === 'video' ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Clapperboard className="h-4 w-4 text-white" />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex h-14 w-10 items-center justify-center rounded-lg border border-border/60 bg-muted/20 text-muted-foreground">
      <Clapperboard className="h-4 w-4" />
    </div>
  );
}

export function StoriesWorkspace() {
  const queryClient = useQueryClient();
  const [selectedStoryGroupId, setSelectedStoryGroupId] = useState('all');
  const [mediaFilter, setMediaFilter] = useState<MediaFilterValue>('all');
  const [publishFilter, setPublishFilter] = useState<PublishFilterValue>('all');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilterValue>('active');
  const [ctaFilter, setCtaFilter] = useState<CtaFilterValue>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<'create' | 'edit'>('create');
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [sheetInitialValues, setSheetInitialValues] =
    useState<StoryFormValues>(emptyStoryFormValues);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const workspaceQuery = useQuery({
    queryKey: ['stories-workspace'],
    queryFn: async (): Promise<WorkspaceData> => {
      const [stories, storyGroups, storyImages, storyVideos, storyPosters] = await Promise.all([
        apiRequest<StoryApiRecord[]>('/api/stories'),
        apiRequest<StoryGroupApiRecord[]>('/api/story-groups'),
        apiRequest<AssetApiRecord[]>('/api/assets?type=story_image'),
        apiRequest<AssetApiRecord[]>('/api/assets?type=story_video'),
        apiRequest<AssetApiRecord[]>('/api/assets?type=story_poster'),
      ]);

      return {
        stories,
        storyGroups,
        storyImages,
        storyVideos,
        storyPosters,
      };
    },
  });

  const stories = workspaceQuery.data?.stories ?? emptyStories;
  const storyGroups = workspaceQuery.data?.storyGroups ?? emptyStoryGroups;
  const storyAssets = useMemo(
    () => [
      ...(workspaceQuery.data?.storyImages ?? []),
      ...(workspaceQuery.data?.storyVideos ?? []),
      ...(workspaceQuery.data?.storyPosters ?? []),
    ],
    [
      workspaceQuery.data?.storyImages,
      workspaceQuery.data?.storyPosters,
      workspaceQuery.data?.storyVideos,
    ],
  );
  const assetById = useMemo(
    () => new Map(storyAssets.map((asset) => [asset.id, asset])),
    [storyAssets],
  );
  const storyGroupOptions = useMemo(
    () => [...storyGroups].sort((left, right) => left.name.localeCompare(right.name, 'tr')),
    [storyGroups],
  );
  const storyGroupFilterOptions = useMemo(
    () =>
      storyGroups
        .filter((storyGroup) => storyGroup.archiveState === 'active')
        .sort((left, right) => left.name.localeCompare(right.name, 'tr')),
    [storyGroups],
  );

  useEffect(() => {
    if (selectedStoryGroupId === 'all') {
      return;
    }

    if (!storyGroupFilterOptions.some((storyGroup) => storyGroup.id === selectedStoryGroupId)) {
      setSelectedStoryGroupId('all');
    }
  }, [selectedStoryGroupId, storyGroupFilterOptions]);

  const filteredStories = useMemo(() => {
    return stories.filter((story) => {
      if (selectedStoryGroupId !== 'all' && story.groupId !== selectedStoryGroupId) {
        return false;
      }

      if (mediaFilter !== 'all' && story.mediaType !== mediaFilter) {
        return false;
      }

      if (publishFilter !== 'all' && story.publishState !== publishFilter) {
        return false;
      }

      if (archiveFilter !== 'all' && story.archiveState !== archiveFilter) {
        return false;
      }

      if (ctaFilter === 'with_cta' && !story.cta) {
        return false;
      }

      if (ctaFilter === 'without_cta' && story.cta) {
        return false;
      }

      return true;
    });
  }, [archiveFilter, ctaFilter, mediaFilter, publishFilter, selectedStoryGroupId, stories]);

  const storyPageCount = useMemo(
    () => Math.max(1, Math.ceil(filteredStories.length / ADMIN_TABLE_PAGE_SIZE)),
    [filteredStories.length],
  );
  const paginatedStories = useMemo(() => {
    const safeCurrentPage = Math.min(Math.max(currentPage, 1), storyPageCount);
    const pageStart = (safeCurrentPage - 1) * ADMIN_TABLE_PAGE_SIZE;
    return filteredStories.slice(pageStart, pageStart + ADMIN_TABLE_PAGE_SIZE);
  }, [currentPage, filteredStories, storyPageCount]);

  useEffect(() => {
    setCurrentPage(1);
  }, [archiveFilter, ctaFilter, mediaFilter, publishFilter, selectedStoryGroupId]);

  useEffect(() => {
    if (currentPage > storyPageCount) {
      setCurrentPage(storyPageCount);
    }
  }, [currentPage, storyPageCount]);

  const publishedCount = useMemo(
    () => stories.filter((story) => story.publishState === 'published').length,
    [stories],
  );
  const archivedCount = useMemo(
    () => stories.filter((story) => story.archiveState === 'archived').length,
    [stories],
  );
  const pendingChangesCount = useMemo(
    () => stories.filter((story) => hasUnpublishedChanges(story)).length,
    [stories],
  );

  const hasActiveFilters =
    selectedStoryGroupId !== 'all' ||
    mediaFilter !== 'all' ||
    publishFilter !== 'all' ||
    archiveFilter !== 'active' ||
    ctaFilter !== 'all';

  const resetFilters = () => {
    setSelectedStoryGroupId('all');
    setMediaFilter('all');
    setPublishFilter('all');
    setArchiveFilter('active');
    setCtaFilter('all');
  };

  const createStoryMutation = useMutation({
    mutationFn: (values: StoryFormSubmitValues) =>
      apiRequest<StoryApiRecord>('/api/stories', {
        method: 'POST',
        body: JSON.stringify(values),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['stories-workspace'] });
      handleSheetChange(false);
    },
  });

  const updateStoryMutation = useMutation({
    mutationFn: ({ storyId, values }: { storyId: string; values: StoryFormSubmitValues }) =>
      apiRequest<StoryApiRecord>(`/api/stories/${storyId}`, {
        method: 'PUT',
        body: JSON.stringify(values),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['stories-workspace'] });
      handleSheetChange(false);
    },
  });

  const patchStoryMutation = useMutation({
    mutationFn: ({
      storyId,
      action,
    }: {
      storyId: string;
      action: 'archive' | 'restore' | 'publish';
    }) =>
      apiRequest<StoryApiRecord>(`/api/stories/${storyId}`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['stories-workspace'] });
    },
  });

  function toFormValues(story: StoryApiRecord): StoryFormValues {
    return {
      name: story.name,
      groupId: story.groupId,
      position: String(story.position ?? 1),
      mediaType: story.mediaType,
      assetId: story.assetId,
      posterAssetId: story.posterAssetId ?? '',
      imageDurationSeconds: story.imageDurationMs
        ? String(Math.round(story.imageDurationMs / 1000))
        : '',
      hasCta: Boolean(story.cta),
      ctaLabel: story.cta?.label ?? '',
      ctaType: story.cta?.type ?? 'url',
      ctaValue: story.cta?.value ?? '',
    };
  }

  const handleSheetChange = (open: boolean) => {
    setIsSheetOpen(open);

    if (!open) {
      setSubmitError(null);
      setSheetMode('create');
      setActiveStoryId(null);
      setSheetInitialValues(emptyStoryFormValues);
    }
  };

  const openCreateSheet = () => {
    const selectedStoryGroup =
      selectedStoryGroupId !== 'all'
        ? (storyGroups.find((storyGroup) => storyGroup.id === selectedStoryGroupId) ?? null)
        : null;

    setSubmitError(null);
    setSheetMode('create');
    setActiveStoryId(null);
    setSheetInitialValues({
      ...emptyStoryFormValues,
      groupId: selectedStoryGroup?.id ?? '',
      position: String((selectedStoryGroup?.storyCount ?? 0) + 1 || 1),
    });
    setIsSheetOpen(true);
  };

  const openEditSheet = (story: StoryApiRecord) => {
    setSubmitError(null);
    setSheetMode('edit');
    setActiveStoryId(story.id);
    setSheetInitialValues(toFormValues(story));
    setIsSheetOpen(true);
  };

  const handleSubmitStory = async (
    values: StoryFormSubmitValues,
  ): Promise<StoryFormSubmitResult> => {
    setSubmitError(null);

    try {
      if (sheetMode === 'edit') {
        if (!activeStoryId) {
          setSubmitError('Düzenlenecek Story bulunamadı. Listeyi yenileyin.');
          return undefined;
        }

        await updateStoryMutation.mutateAsync({
          storyId: activeStoryId,
          values,
        });
      } else {
        await createStoryMutation.mutateAsync(values);
      }

      return undefined;
    } catch (error) {
      if (error instanceof ApiRequestError && error.message.includes('archived story group')) {
        return {
          fieldErrors: {
            groupId: error.message,
          },
        };
      }

      if (error instanceof ApiRequestError && error.code === 'validation_error') {
        if (error.message.includes('Group')) {
          return {
            fieldErrors: {
              groupId: error.message,
            },
          };
        }

        if (error.message.includes('pozisyon')) {
          return {
            fieldErrors: {
              position: error.message,
            },
          };
        }

        if (error.message.includes('poster')) {
          return {
            fieldErrors: {
              posterAssetId: error.message,
            },
          };
        }

        if (error.message.includes('duration')) {
          return {
            fieldErrors: {
              imageDurationSeconds: error.message,
            },
          };
        }

        if (error.message.includes('CTA')) {
          return {
            fieldErrors: {
              ctaValue: error.message,
            },
          };
        }

        if (
          error.message.includes('story_image') ||
          error.message.includes('story_video') ||
          error.message.includes('asset')
        ) {
          return {
            fieldErrors: {
              assetId: error.message,
            },
          };
        }
      }

      setSubmitError(
        error instanceof Error
          ? error.message
          : sheetMode === 'edit'
            ? 'Story güncellenemedi.'
            : 'Story oluşturulamadı.',
      );
      return undefined;
    }
  };

  const handleRowAction = async (
    story: StoryApiRecord,
    action: 'archive' | 'restore' | 'publish',
  ) => {
    setActionError(null);

    try {
      await patchStoryMutation.mutateAsync({
        storyId: story.id,
        action,
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Story aksiyonu uygulanamadı.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <PageHeaderActionButton disabled={storyGroups.length === 0} onClick={openCreateSheet}>
            <Plus aria-hidden data-icon="inline-start" />
            Yeni Story
          </PageHeaderActionButton>
        }
        title="Story listesi"
      />

      <section className="space-y-4">
        <StoryStats
          archivedCount={archivedCount}
          pendingChangesCount={pendingChangesCount}
          publishedCount={publishedCount}
          totalCount={stories.length}
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
              <CardTitle>Story listesi yüklenemedi</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {(workspaceQuery.error as ApiRequestError | Error | undefined)?.message ??
                  'Story listesi şu anda alınamıyor.'}
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
                <Clapperboard className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl">Önce bir Story Group oluşturun</CardTitle>
            </CardHeader>
          </Card>
        ) : stories.length === 0 ? (
          <Card className="border-border/60 border-dashed bg-card/80">
            <CardHeader className="items-start text-left">
              <div className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
                <Clapperboard className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl">Henüz Story kaydı yok</CardTitle>
            </CardHeader>
            <CardContent>
              <Button className="gap-2" onClick={openCreateSheet}>
                <Plus className="h-4 w-4" />
                İlk Story&apos;yi oluştur
              </Button>
            </CardContent>
          </Card>
        ) : (
          <AdminTablePanel
            currentPage={currentPage}
            filterGridClassName="md:grid-cols-5"
            filters={
              <>
                <AdminFilterSelect
                  label="Story Group"
                  onChange={setSelectedStoryGroupId}
                  options={[
                    { label: 'Tüm grouplar', value: 'all' },
                    ...storyGroupFilterOptions.map((storyGroup) => ({
                      label: storyGroup.name,
                      value: storyGroup.id,
                    })),
                  ]}
                  value={selectedStoryGroupId}
                />

                <AdminFilterSelect
                  label="Media"
                  onChange={(value) => setMediaFilter(value as MediaFilterValue)}
                  options={[
                    { label: 'Tümü', value: 'all' },
                    { label: 'Image', value: 'image' },
                    { label: 'Video', value: 'video' },
                  ]}
                  value={mediaFilter}
                />

                <AdminFilterSelect
                  label="Publish"
                  onChange={(value) => setPublishFilter(value as PublishFilterValue)}
                  options={[
                    { label: 'Tümü', value: 'all' },
                    { label: 'Published', value: 'published' },
                    { label: 'Unpublished', value: 'unpublished' },
                  ]}
                  value={publishFilter}
                />

                <AdminFilterSelect
                  label="Archive"
                  onChange={(value) => setArchiveFilter(value as ArchiveFilterValue)}
                  options={[
                    { label: 'Tümü', value: 'all' },
                    { label: 'Active', value: 'active' },
                    { label: 'Archived', value: 'archived' },
                  ]}
                  value={archiveFilter}
                />

                <AdminFilterSelect
                  label="CTA"
                  onChange={(value) => setCtaFilter(value as CtaFilterValue)}
                  options={[
                    { label: 'Tümü', value: 'all' },
                    { label: 'CTA var', value: 'with_cta' },
                    { label: 'CTA yok', value: 'without_cta' },
                  ]}
                  value={ctaFilter}
                />
              </>
            }
            hasActiveFilters={hasActiveFilters}
            onPageChange={setCurrentPage}
            onResetFilters={resetFilters}
            pageCount={storyPageCount}
            visibleCount={filteredStories.length}
          >
            <Table className="min-w-[980px]">
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="border-b border-border/60">Story</TableHead>
                  <TableHead className="border-b border-border/60">Group</TableHead>
                  <TableHead className="border-b border-border/60">CTA</TableHead>
                  <TableHead className="border-b border-border/60">Publish</TableHead>
                  <TableHead className="border-b border-border/60">Archive</TableHead>
                  <TableHead className="border-b border-border/60">Last Update</TableHead>
                  <TableHead className="border-b border-border/60 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedStories.length === 0 ? (
                  <TableRow>
                    <TableCell
                      className="py-10 text-center text-sm text-muted-foreground"
                      colSpan={7}
                    >
                      Filtrelerle eşleşen Story bulunamadı.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedStories.map((story) => {
                    const draftChangesPending = hasUnpublishedChanges(story);
                    const canPublishDraft = canPublish(story) && story.archiveState !== 'archived';
                    const publishLabel = publishActionLabel(story);

                    return (
                      <TableRow key={story.id} className="align-top">
                        <TableCell className="border-b border-border/60 py-4 align-top">
                          <div className="flex items-start gap-3">
                            <StoryThumbnail assetById={assetById} story={story} />
                            <div className="space-y-2">
                              <div className="space-y-1">
                                <p className="font-semibold">{story.name}</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="secondary">
                                  {story.mediaType === 'video' ? 'Video' : 'Image'}
                                </Badge>
                                <Badge variant="outline">{formatDurationLabel(story)}</Badge>
                                {story.mediaType === 'video' && !story.posterAssetId ? (
                                  <Badge variant="destructive">Poster eksik</Badge>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="border-b border-border/60 py-4 align-top">
                          <div className="space-y-2">
                            <p className="font-medium">{story.groupName}</p>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline">Sıra {story.position ?? '-'}</Badge>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="border-b border-border/60 py-4 align-top">
                          {story.cta ? (
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="secondary">{story.cta.label}</Badge>
                                <Badge variant="outline">{story.cta.type}</Badge>
                              </div>
                              <p className="max-w-[260px] text-xs leading-5 text-muted-foreground">
                                {story.cta.value}
                              </p>
                            </div>
                          ) : (
                            <Badge variant="outline">CTA yok</Badge>
                          )}
                        </TableCell>

                        <TableCell className="border-b border-border/60 py-4 align-top">
                          <div className="flex flex-wrap items-center gap-2">
                            {story.publishState === 'published' ? (
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                            ) : (
                              <CircleSlash className="h-4 w-4 text-muted-foreground" />
                            )}
                            <StateBadge type="publish" value={story.publishState} />
                            {draftChangesPending ? (
                              <Badge variant="secondary">Taslak değişiklik var</Badge>
                            ) : null}
                          </div>
                        </TableCell>

                        <TableCell className="border-b border-border/60 py-4 align-top">
                          <div className="flex items-center gap-2">
                            <Archive className="h-4 w-4 text-muted-foreground" />
                            <StateBadge type="archive" value={story.archiveState} />
                          </div>
                        </TableCell>

                        <TableCell className="border-b border-border/60 py-4 align-top">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <CalendarClock className="h-4 w-4 text-muted-foreground" />
                            {formatDate(story.updatedAt)}
                          </div>
                        </TableCell>

                        <TableCell className="border-b border-border/60 py-4 align-top text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button className="ml-auto" size="icon" variant="ghost">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Story actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => openEditSheet(story)}>
                                <PencilLine className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={() =>
                                  handleRowAction(
                                    story,
                                    story.archiveState === 'archived' ? 'restore' : 'archive',
                                  )
                                }
                              >
                                <Archive className="mr-2 h-4 w-4" />
                                {story.archiveState === 'archived' ? 'Restore' : 'Archive'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!canPublishDraft}
                                onSelect={() => handleRowAction(story, 'publish')}
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                {publishLabel}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </AdminTablePanel>
        )}
      </section>

      <StorySheet
        generalError={submitError}
        initialValues={sheetInitialValues}
        mode={sheetMode}
        onOpenChange={handleSheetChange}
        onSubmit={handleSubmitStory}
        open={isSheetOpen}
        storyGroups={storyGroupOptions}
      />
    </div>
  );
}
