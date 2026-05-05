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
import {
  Archive,
  CalendarClock,
  CheckCircle2,
  CircleSlash,
  Clapperboard,
  ListFilter,
  MoreHorizontal,
  PencilLine,
  Plus,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import {
  StoryFormSubmitResult,
  StoryFormSubmitValues,
  StoryFormValues,
} from '@/components/admin/story-form';
import { StorySheet } from '@/components/admin/story-sheet';
import { PageHeader } from '@/components/admin/page-header';
import { ApiRequestError, apiRequest } from '@/lib/api';

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

function hasUnpublishedChanges(story: StoryApiRecord): boolean {
  return Boolean(story.currentPublishedRevisionId && story.currentPublishedRevisionId !== story.currentDraftRevisionId);
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
        <img alt={previewAsset.name} className="h-full w-full object-cover" src={previewAsset.url} />
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
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<'create' | 'edit'>('create');
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [sheetInitialValues, setSheetInitialValues] = useState<StoryFormValues>(emptyStoryFormValues);
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
    [workspaceQuery.data?.storyImages, workspaceQuery.data?.storyPosters, workspaceQuery.data?.storyVideos],
  );
  const assetById = useMemo(() => new Map(storyAssets.map((asset) => [asset.id, asset])), [storyAssets]);
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

  const publishedCount = useMemo(
    () => stories.filter((story) => story.publishState === 'published').length,
    [stories],
  );
  const archivedCount = useMemo(
    () => stories.filter((story) => story.archiveState === 'archived').length,
    [stories],
  );
  const videoCount = useMemo(
    () => stories.filter((story) => story.mediaType === 'video').length,
    [stories],
  );
  const ctaCount = useMemo(() => stories.filter((story) => Boolean(story.cta)).length, [stories]);
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
    mutationFn: ({
      storyId,
      values,
    }: {
      storyId: string;
      values: StoryFormSubmitValues;
    }) =>
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
      imageDurationSeconds: story.imageDurationMs ? String(Math.round(story.imageDurationMs / 1000)) : '',
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
        ? storyGroups.find((storyGroup) => storyGroup.id === selectedStoryGroupId) ?? null
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

        if (error.message.includes('story_image') || error.message.includes('story_video') || error.message.includes('asset')) {
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
          <Button className="gap-2" disabled={storyGroups.length === 0} onClick={openCreateSheet}>
            <Plus className="h-4 w-4" />
            Yeni Story
          </Button>
        }
        description="Story içeriklerini burada oluşturabilir ve düzenleyebilirsiniz."
        eyebrow="Stories"
        title="Story listesi"
      />

      <section className="space-y-4">
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/80 p-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Body</p>
            <h2 className="text-xl font-semibold tracking-tight">Tanımlı Story kayıtları</h2>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Story&apos;ler bu tabloda grup, medya ve durum bilgileriyle birlikte listelenir.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{stories.length} story</Badge>
            <Badge variant="secondary">{publishedCount} yayında</Badge>
            <Badge variant="secondary">{pendingChangesCount} taslak değişiklik</Badge>
            <Badge variant="secondary">{archivedCount} arşivde</Badge>
            <Badge variant="secondary">{videoCount} video</Badge>
            <Badge variant="secondary">{ctaCount} CTA</Badge>
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
              <CardTitle>Story listesi yüklenemedi</CardTitle>
              <CardDescription>
                {(workspaceQuery.error as ApiRequestError | Error | undefined)?.message ??
                  'Story listesi şu anda alınamıyor.'}
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
                <Clapperboard className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl">Önce bir Story Group oluşturun</CardTitle>
              <CardDescription className="max-w-2xl leading-6">
                Story eklemek için önce bir Story Group seçilebilir durumda olmalıdır.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : stories.length === 0 ? (
          <Card className="border-border/60 border-dashed bg-card/80">
            <CardHeader className="items-start text-left">
              <div className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
                <Clapperboard className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl">Henüz Story kaydı yok</CardTitle>
              <CardDescription className="max-w-2xl leading-6">
                İlk Story&apos;yi oluşturduğunuzda burada listelenir.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="gap-2" onClick={openCreateSheet}>
                <Plus className="h-4 w-4" />
                İlk Story&apos;yi oluştur
              </Button>
            </CardContent>
          </Card>
        ) : filteredStories.length === 0 ? (
          <Card className="border-border/60 border-dashed bg-card/80">
            <CardHeader>
              <CardTitle>Filtrelerle eşleşen Story bulunamadı</CardTitle>
              <CardDescription>
                Seçili filtrelerle eşleşen kayıt bulunamadı.
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
                    Filtreler
                  </div>
                  <CardTitle>Story tablosu</CardTitle>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {hasActiveFilters ? (
                    <Button onClick={resetFilters} size="sm" variant="outline">
                      Filtreleri temizle
                    </Button>
                  ) : null}
                  <Badge variant="secondary">{filteredStories.length} görünür satır</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-5">
                <FilterSelect
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

                <FilterSelect
                  label="Media"
                  onChange={(value) => setMediaFilter(value as MediaFilterValue)}
                  options={[
                    { label: 'Tümü', value: 'all' },
                    { label: 'Image', value: 'image' },
                    { label: 'Video', value: 'video' },
                  ]}
                  value={mediaFilter}
                />

                <FilterSelect
                  label="Publish"
                  onChange={(value) => setPublishFilter(value as PublishFilterValue)}
                  options={[
                    { label: 'Tümü', value: 'all' },
                    { label: 'Published', value: 'published' },
                    { label: 'Unpublished', value: 'unpublished' },
                  ]}
                  value={publishFilter}
                />

                <FilterSelect
                  label="Archive"
                  onChange={(value) => setArchiveFilter(value as ArchiveFilterValue)}
                  options={[
                    { label: 'Tümü', value: 'all' },
                    { label: 'Active', value: 'active' },
                    { label: 'Archived', value: 'archived' },
                  ]}
                  value={archiveFilter}
                />

                <FilterSelect
                  label="CTA"
                  onChange={(value) => setCtaFilter(value as CtaFilterValue)}
                  options={[
                    { label: 'Tümü', value: 'all' },
                    { label: 'CTA var', value: 'with_cta' },
                    { label: 'CTA yok', value: 'without_cta' },
                  ]}
                  value={ctaFilter}
                />
              </div>

              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
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
                  {filteredStories.map((story) => {
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
                                <Badge variant="secondary">{story.mediaType === 'video' ? 'Video' : 'Image'}</Badge>
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
                              <p className="max-w-[260px] text-xs leading-5 text-muted-foreground">{story.cta.value}</p>
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
                            {draftChangesPending ? <Badge variant="secondary">Taslak değişiklik var</Badge> : null}
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
                                onSelect={() =>
                                  handleRowAction(story, 'publish')
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
