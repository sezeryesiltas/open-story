'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@open-story/ui/components/badge';
import { Button } from '@open-story/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@open-story/ui/components/dialog';
import { Input } from '@open-story/ui/components/input';
import { Label } from '@open-story/ui/components/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@open-story/ui/components/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@open-story/ui/components/sheet';
import { Skeleton } from '@open-story/ui/components/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@open-story/ui/components/table';
import { cn } from '@open-story/ui/lib/utils';
import {
  CheckCircle2,
  Clapperboard,
  CloudUpload,
  CircleSlash,
  Eye,
  ImagePlus,
  LinkIcon,
  Plus,
  Search,
  Trash2,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';

import { AdminFilterSelect, AdminTablePanel } from '@/components/admin/admin-table-panel';
import { PageHeader, PageHeaderActionButton } from '@/components/admin/page-header';
import { ApiRequestError, apiRequest } from '@/lib/api';
import { ASSET_UPLOAD_CAPABILITIES_QUERY_KEY, AssetUploadCapabilitiesDto, canUseServerAssetUpload } from '@/lib/asset-storage-settings';
import { formatMetricCount } from '@/lib/database-settings-presentation';

type AssetType = 'group_logo' | 'story_image' | 'story_video' | 'story_poster';
type UsageFilter = 'all' | 'used' | 'unused';
type AssetSource = 'upload' | 'url' | 'cloud_upload';
type SourceFilter = 'all' | AssetSource;
type CreateMode = 'upload' | 'url' | 'cloud_upload';

type AssetUsageReference = {
  entityType: 'story_group' | 'story';
  entityId: string;
  revisionId: string;
  revisionStatus: 'draft' | 'published';
  field: 'logo' | 'media' | 'poster';
  name: string;
};

type AssetApiRecord = {
  id: string;
  type: AssetType;
  url: string;
  name: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  sizeBytes: number | null;
  source: AssetSource;
  usageCount: number;
  usageReferences: AssetUsageReference[];
  createdAt: string;
  updatedAt: string;
};

const ASSET_TYPES: Array<{ value: AssetType; label: string; accept: string }> = [
  { value: 'group_logo', label: 'Group logo', accept: 'image/png,image/jpeg,image/webp,image/svg+xml' },
  { value: 'story_image', label: 'Story image', accept: 'image/png,image/jpeg,image/webp' },
  { value: 'story_video', label: 'Story video', accept: 'video/mp4' },
  { value: 'story_poster', label: 'Story poster', accept: 'image/png,image/jpeg,image/webp' },
];

const emptyAssets: AssetApiRecord[] = [];
const ASSET_TABLE_PAGE_SIZE = 15;

function getAssetTypeLabel(type: AssetType): string {
  return ASSET_TYPES.find((item) => item.value === type)?.label ?? type;
}

function getAssetAccept(type: AssetType): string {
  return ASSET_TYPES.find((item) => item.value === type)?.accept ?? '';
}

function getAssetSourceLabel(source: AssetSource): string {
  if (source === 'cloud_upload') {
    return 'Cloud Upload';
  }

  return source === 'upload' ? 'Server Upload' : 'URL';
}

function formatFileSize(sizeBytes: number | null): string {
  if (!sizeBytes || sizeBytes <= 0) {
    return 'Bilinmiyor';
  }

  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(durationMs: number | null): string | null {
  if (!durationMs || durationMs <= 0) {
    return null;
  }

  return `${(durationMs / 1000).toFixed(1)} sn`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function getUsageLabel(reference: AssetUsageReference): string {
  const entityLabel = reference.entityType === 'story_group' ? 'Group' : 'Story';
  const fieldLabel =
    reference.field === 'logo' ? 'Logo' : reference.field === 'poster' ? 'Poster' : 'Media';
  const statusLabel = reference.revisionStatus === 'published' ? 'Published' : 'Draft';

  return `${entityLabel} / ${fieldLabel} / ${statusLabel}`;
}

function AssetPreview({ asset, large = false }: { asset: AssetApiRecord; large?: boolean }) {
  if (asset.type === 'story_video') {
    if (large) {
      return (
        <video
          className="max-h-[58dvh] w-full rounded-lg bg-black object-contain"
          controls
          muted
          playsInline
          preload="metadata"
          src={asset.url}
        />
      );
    }

    return (
      <div className="flex h-full w-full items-center justify-center bg-muted/30 text-muted-foreground">
        <Clapperboard className="h-5 w-5" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={asset.name}
      className={large ? 'max-h-[58dvh] w-full rounded-lg object-contain' : 'h-full w-full object-cover'}
      src={asset.url}
    />
  );
}

function AssetStats({ assets }: { assets: AssetApiRecord[] }) {
  const usedCount = assets.filter((asset) => asset.usageCount > 0).length;
  const unusedCount = assets.length - usedCount;
  const stats: Array<{
    icon: LucideIcon;
    label: string;
    unit: string;
    value: number;
  }> = [
    {
      icon: ImagePlus,
      label: 'Assets',
      unit: 'Asset',
      value: assets.length,
    },
    {
      icon: CheckCircle2,
      label: 'Kullanılan',
      unit: 'Used',
      value: usedCount,
    },
    {
      icon: CircleSlash,
      label: 'Kullanılmayan',
      unit: 'Unused',
      value: unusedCount,
    },
  ];

  return (
    <section className="grid gap-6 md:grid-cols-3">
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

function AssetMetadata({ asset }: { asset: AssetApiRecord }) {
  return (
    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
      <p>{asset.width && asset.height ? `${asset.width}x${asset.height}` : 'Boyut bilinmiyor'}</p>
      <p>{formatFileSize(asset.sizeBytes)}</p>
      {formatDuration(asset.durationMs) ? <p>{formatDuration(asset.durationMs)}</p> : null}
    </div>
  );
}

function AssetUsageSummary({ asset }: { asset: AssetApiRecord }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Badge className="w-fit" variant={asset.usageCount > 0 ? 'default' : 'outline'}>
        {asset.usageCount > 0 ? `${asset.usageCount} referans` : 'Kullanılmıyor'}
      </Badge>
      {asset.usageReferences[0] ? (
        <p className="truncate text-xs text-muted-foreground">{asset.usageReferences[0].name}</p>
      ) : null}
    </div>
  );
}

function AssetActions({
  asset,
  isDeleting,
  onDelete,
}: {
  asset: AssetApiRecord;
  isDeleting: boolean;
  onDelete: (asset: AssetApiRecord) => void;
}) {
  return (
    <div className="flex justify-end gap-2">
      <Dialog>
        <DialogTrigger asChild>
          <Button size="icon" type="button" variant="outline">
            <Eye className="h-4 w-4" />
            <span className="sr-only">Preview</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{asset.name}</DialogTitle>
            <DialogDescription>{getAssetTypeLabel(asset.type)} preview.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="overflow-hidden rounded-lg border border-border/60 bg-muted/20 p-3">
              <AssetPreview asset={asset} large />
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{getAssetTypeLabel(asset.type)}</Badge>
              <Badge variant="secondary">
                {asset.width && asset.height ? `${asset.width}x${asset.height}` : 'Boyut bilinmiyor'}
              </Badge>
              <Badge variant="secondary">{formatFileSize(asset.sizeBytes)}</Badge>
              <Badge variant="secondary">{getAssetSourceLabel(asset.source)}</Badge>
              <Badge variant={asset.usageCount > 0 ? 'default' : 'outline'}>
                {asset.usageCount > 0 ? `${asset.usageCount} referans` : 'Kullanılmıyor'}
              </Badge>
            </div>
            {asset.usageReferences[0] ? (
              <p className="truncate text-xs text-muted-foreground">
                İlk referans: {asset.usageReferences[0].name} / {getUsageLabel(asset.usageReferences[0])}
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
      <Button
        disabled={asset.usageCount > 0 || isDeleting}
        onClick={() => onDelete(asset)}
        size="icon"
        type="button"
        variant="outline"
      >
        <Trash2 className="h-4 w-4" />
        <span className="sr-only">Sil</span>
      </Button>
    </div>
  );
}

function AssetCardList({
  assets,
  isDeleting,
  isLoading,
  onDelete,
}: {
  assets: AssetApiRecord[];
  isDeleting: boolean;
  isLoading: boolean;
  onDelete: (asset: AssetApiRecord) => void;
}) {
  if (isLoading && assets.length === 0) {
    return (
      <div className="grid gap-3 xl:hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton className="h-40 w-full rounded-2xl" key={index} />
        ))}
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-background/45 p-8 text-center text-sm text-muted-foreground xl:hidden">
        Asset bulunamadı.
      </div>
    );
  }

  return (
    <div className="grid gap-3 xl:hidden">
      {assets.map((asset) => (
        <div
          className="rounded-2xl border border-border/60 bg-background/45 p-4"
          key={asset.id}
        >
          <div className="flex min-w-0 gap-3">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-background">
              <AssetPreview asset={asset} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{asset.name}</p>
              <p className="truncate text-xs text-muted-foreground">{asset.id}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="secondary">{getAssetTypeLabel(asset.type)}</Badge>
                <Badge variant="outline">{getAssetSourceLabel(asset.source)}</Badge>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Metadata
              </p>
              <AssetMetadata asset={asset} />
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Kullanım
              </p>
              <AssetUsageSummary asset={asset} />
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Oluşturma
              </p>
              <p className="text-xs text-muted-foreground">{formatDate(asset.createdAt)}</p>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <AssetActions asset={asset} isDeleting={isDeleting} onDelete={onDelete} />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyRows({ isLoading }: { isLoading: boolean }) {
  if (isLoading) {
    return (
      <>
        {Array.from({ length: 5 }).map((_, index) => (
          <TableRow key={index}>
            <TableCell colSpan={7}>
              <Skeleton className="h-14 w-full" />
            </TableCell>
          </TableRow>
        ))}
      </>
    );
  }

  return (
    <TableRow>
      <TableCell className="h-28 text-center text-sm text-muted-foreground" colSpan={7}>
        Asset bulunamadı.
      </TableCell>
    </TableRow>
  );
}

export function AssetsWorkspace() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<AssetType | 'all'>('all');
  const [usageFilter, setUsageFilter] = useState<UsageFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [searchValue, setSearchValue] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [createType, setCreateType] = useState<AssetType>('story_image');
  const [createMode, setCreateMode] = useState<CreateMode>('cloud_upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [urlValue, setUrlValue] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const assetsQuery = useQuery({
    queryKey: ['assets-management'],
    queryFn: () => apiRequest<AssetApiRecord[]>('/api/assets'),
  });
  const storageSettingsQuery = useQuery({
    queryKey: ASSET_UPLOAD_CAPABILITIES_QUERY_KEY,
    queryFn: () => apiRequest<AssetUploadCapabilitiesDto>('/api/assets/upload-capabilities'),
  });
  const serverUploadAllowed = canUseServerAssetUpload(storageSettingsQuery.data);

  useEffect(() => {
    if (!serverUploadAllowed && createMode === 'upload') {
      setCreateMode('cloud_upload');
    }
  }, [createMode, serverUploadAllowed]);
  const effectiveCreateMode = createMode === 'upload' && !serverUploadAllowed ? 'cloud_upload' : createMode;

  const assets = assetsQuery.data ?? emptyAssets;
  const filteredAssets = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLocaleLowerCase('tr-TR');

    return assets.filter((asset) => {
      if (typeFilter !== 'all' && asset.type !== typeFilter) {
        return false;
      }

      if (usageFilter === 'used' && asset.usageCount === 0) {
        return false;
      }

      if (usageFilter === 'unused' && asset.usageCount > 0) {
        return false;
      }

      if (sourceFilter !== 'all' && asset.source !== sourceFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchableValue = `${asset.name} ${asset.id} ${asset.url}`.toLocaleLowerCase('tr-TR');
      return searchableValue.includes(normalizedSearch);
    });
  }, [assets, searchValue, sourceFilter, typeFilter, usageFilter]);
  const hasActiveFilters =
    typeFilter !== 'all' ||
    usageFilter !== 'all' ||
    sourceFilter !== 'all' ||
    searchValue.trim().length > 0;
  const assetPageCount = useMemo(
    () => Math.max(1, Math.ceil(filteredAssets.length / ASSET_TABLE_PAGE_SIZE)),
    [filteredAssets.length],
  );
  const paginatedAssets = useMemo(() => {
    const safeCurrentPage = Math.min(Math.max(currentPage, 1), assetPageCount);
    const pageStart = (safeCurrentPage - 1) * ASSET_TABLE_PAGE_SIZE;
    return filteredAssets.slice(pageStart, pageStart + ASSET_TABLE_PAGE_SIZE);
  }, [assetPageCount, currentPage, filteredAssets]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchValue, sourceFilter, typeFilter, usageFilter]);

  useEffect(() => {
    if (currentPage > assetPageCount) {
      setCurrentPage(assetPageCount);
    }
  }, [assetPageCount, currentPage]);

  const uploadAssetMutation = useMutation({
    mutationFn: async (payload: { type: AssetType; file: File; storage: 'local' | 'cloud' }) => {
      const formData = new FormData();
      formData.set('type', payload.type);
      formData.set('file', payload.file);

      const response = await fetch(payload.storage === 'cloud' ? '/api/assets?storage=cloud' : '/api/assets', {
        method: 'POST',
        body: formData,
      });
      const contentType = response.headers.get('content-type') ?? '';
      const responsePayload = contentType.includes('application/json')
        ? await response.json().catch(() => null)
        : null;

      if (!response.ok) {
        throw new ApiRequestError(
          responsePayload?.error?.message ?? `Upload başarısız oldu (${response.status}).`,
          response.status,
          responsePayload?.error?.code,
        );
      }

      return responsePayload as AssetApiRecord;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['assets-management'] });
      setSelectedFile(null);
      setCreateError(null);
    },
  });

  const importAssetMutation = useMutation({
    mutationFn: (payload: { type: AssetType; url: string }) =>
      apiRequest<AssetApiRecord>('/api/assets', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['assets-management'] });
      setUrlValue('');
      setCreateError(null);
    },
  });

  const deleteAssetMutation = useMutation({
    mutationFn: (assetId: string) =>
      apiRequest<void>(`/api/assets/${assetId}`, {
        method: 'DELETE',
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['assets-management'] });
      setDeleteError(null);
    },
  });

  const resetFilters = () => {
    setTypeFilter('all');
    setUsageFilter('all');
    setSourceFilter('all');
    setSearchValue('');
  };

  const resetCreateForm = () => {
    setCreateType('story_image');
    setCreateMode('cloud_upload');
    setSelectedFile(null);
    setUrlValue('');
    setCreateError(null);
  };

  const handleCreateSheetChange = (open: boolean) => {
    setIsCreateSheetOpen(open);

    if (!open) {
      resetCreateForm();
    }
  };

  const openCreateSheet = () => {
    setCreateError(null);
    setIsCreateSheetOpen(true);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setCreateError(null);
    setSelectedFile(event.target.files?.[0] ?? null);
  };

  const handleCreate = async () => {
    setCreateError(null);

    try {
      if (effectiveCreateMode === 'upload' || effectiveCreateMode === 'cloud_upload') {
        if (!selectedFile) {
          setCreateError('Upload için dosya seçin.');
          return;
        }

        await uploadAssetMutation.mutateAsync({
          type: createType,
          file: selectedFile,
          storage: effectiveCreateMode === 'cloud_upload' ? 'cloud' : 'local',
        });
        handleCreateSheetChange(false);
        return;
      }

      if (!urlValue.trim()) {
        setCreateError('URL ile eklemek için asset URL girin.');
        return;
      }

      await importAssetMutation.mutateAsync({ type: createType, url: urlValue.trim() });
      handleCreateSheetChange(false);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Asset oluşturulamadı.');
    }
  };

  const handleDelete = async (asset: AssetApiRecord) => {
    setDeleteError(null);

    if (asset.usageCount > 0) {
      setDeleteError('Kullanılan asset silinemez.');
      return;
    }

    const confirmed = window.confirm(`${asset.name} asset kaydı silinsin mi?`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteAssetMutation.mutateAsync(asset.id);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Asset silinemedi.');
    }
  };

  const isCreating = uploadAssetMutation.isPending || importAssetMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <PageHeaderActionButton onClick={openCreateSheet} type="button">
            <Plus aria-hidden data-icon="inline-start" />
            Yeni Asset
          </PageHeaderActionButton>
        }
        title="Assets"
      />

      <AssetStats assets={assets} />

      <div className="min-w-0">
          <AdminTablePanel
            currentPage={currentPage}
            filterGridClassName="lg:grid-cols-[minmax(220px,1fr)_180px_160px_160px]"
            filters={
              <>
                <div className="flex flex-col gap-2">
                  <span className="ml-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Arama
                  </span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="h-10 rounded-lg border-border/70 bg-background/60 pl-9"
                      onChange={(event) => setSearchValue(event.target.value)}
                      placeholder="İsim, ID veya URL ara"
                      value={searchValue}
                    />
                  </div>
                </div>

                <AdminFilterSelect
                  label="Tip"
                  onChange={(value) => setTypeFilter(value as AssetType | 'all')}
                  options={[
                    { label: 'Tüm tipler', value: 'all' },
                    ...ASSET_TYPES.map((type) => ({
                      label: type.label,
                      value: type.value,
                    })),
                  ]}
                  value={typeFilter}
                />

                <AdminFilterSelect
                  label="Kullanım"
                  onChange={(value) => setUsageFilter(value as UsageFilter)}
                  options={[
                    { label: 'Tüm kullanım', value: 'all' },
                    { label: 'Kullanılan', value: 'used' },
                    { label: 'Kullanılmayan', value: 'unused' },
                  ]}
                  value={usageFilter}
                />

                <AdminFilterSelect
                  label="Kaynak"
                  onChange={(value) => setSourceFilter(value as SourceFilter)}
                  options={[
                    { label: 'Tüm kaynaklar', value: 'all' },
                    { label: 'Server Upload', value: 'upload' },
                    { label: 'Cloud Upload', value: 'cloud_upload' },
                    { label: 'URL', value: 'url' },
                  ]}
                  value={sourceFilter}
                />
              </>
            }
            hasActiveFilters={hasActiveFilters}
            onPageChange={setCurrentPage}
            onResetFilters={resetFilters}
            pageCount={assetPageCount}
            pageSize={ASSET_TABLE_PAGE_SIZE}
            visibleCount={filteredAssets.length}
          >
            {assetsQuery.error || deleteError ? (
              <div className="space-y-3 p-4">
                {assetsQuery.error ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {assetsQuery.error instanceof Error ? assetsQuery.error.message : 'Asset listesi okunamadı.'}
                  </div>
                ) : null}

                {deleteError ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {deleteError}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="p-4 xl:hidden">
              <AssetCardList
                assets={paginatedAssets}
                isDeleting={deleteAssetMutation.isPending}
                isLoading={assetsQuery.isLoading}
                onDelete={handleDelete}
              />
            </div>

            <Table className="hidden w-full table-fixed xl:table">
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[28%] border-b border-border/60">Asset</TableHead>
                  <TableHead className="w-[13%] border-b border-border/60">Tip</TableHead>
                  <TableHead className="w-[14%] border-b border-border/60">Metadata</TableHead>
                  <TableHead className="w-[18%] border-b border-border/60">Kullanım</TableHead>
                  <TableHead className="w-[12%] border-b border-border/60">Kaynak</TableHead>
                  <TableHead className="w-[11%] border-b border-border/60">Oluşturma</TableHead>
                  <TableHead className="w-[92px] border-b border-border/60 text-right">Aksiyon</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssets.length === 0 ? (
                  <EmptyRows isLoading={assetsQuery.isLoading} />
                ) : (
                  paginatedAssets.map((asset) => (
                    <TableRow className="align-top" key={asset.id}>
                      <TableCell className="border-b border-border/60 py-4 align-top">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-background">
                            <AssetPreview asset={asset} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{asset.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{asset.id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="border-b border-border/60 py-4 align-top">
                        <Badge variant="secondary">{getAssetTypeLabel(asset.type)}</Badge>
                      </TableCell>
                      <TableCell className="border-b border-border/60 py-4 align-top">
                        <AssetMetadata asset={asset} />
                      </TableCell>
                      <TableCell className="border-b border-border/60 py-4 align-top">
                        <AssetUsageSummary asset={asset} />
                      </TableCell>
                      <TableCell className="border-b border-border/60 py-4 align-top">
                        <Badge variant="outline">{getAssetSourceLabel(asset.source)}</Badge>
                      </TableCell>
                      <TableCell className="border-b border-border/60 py-4 align-top text-xs text-muted-foreground">
                        {formatDate(asset.createdAt)}
                      </TableCell>
                      <TableCell className="border-b border-border/60 py-4 align-top text-right">
                        <AssetActions
                          asset={asset}
                          isDeleting={deleteAssetMutation.isPending}
                          onDelete={handleDelete}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </AdminTablePanel>
      </div>

      <Sheet onOpenChange={handleCreateSheetChange} open={isCreateSheetOpen}>
        <SheetContent className="p-0">
          <SheetHeader>
            <SheetTitle>Yeni Asset oluştur</SheetTitle>
            <SheetDescription>
              Asset tipini, kaynak yöntemini ve medya bilgisini girin.
            </SheetDescription>
          </SheetHeader>

          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreate();
            }}
          >
            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-6 sm:px-8">
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                <p className="text-sm font-medium">Asset bilgileri</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Upload veya URL ile eklenen asset kayıtları Story ve Story Group içeriklerinde kullanılabilir.
                </p>
              </div>

              {createError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm leading-6 text-destructive">
                  {createError}
                </div>
              ) : null}

              <div className="flex flex-col gap-2">
                <Label htmlFor="asset-create-type">Tip</Label>
                <Select onValueChange={(value) => setCreateType(value as AssetType)} value={createType}>
                  <SelectTrigger id="asset-create-type">
                    <SelectValue placeholder="Asset tipi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {ASSET_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Kaynak</Label>
                <div
                  className={cn(
                    'grid gap-2 rounded-lg border border-border/60 bg-muted/20 p-1',
                    serverUploadAllowed ? 'grid-cols-3' : 'grid-cols-2',
                  )}
                >
                  {serverUploadAllowed ? (
                    <Button
                      aria-pressed={createMode === 'upload'}
                      onClick={() => setCreateMode('upload')}
                      size="sm"
                      type="button"
                      variant={createMode === 'upload' ? 'default' : 'ghost'}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Server
                    </Button>
                  ) : null}
                  <Button
                    aria-pressed={effectiveCreateMode === 'cloud_upload'}
                    onClick={() => setCreateMode('cloud_upload')}
                    size="sm"
                    type="button"
                    variant={effectiveCreateMode === 'cloud_upload' ? 'default' : 'ghost'}
                  >
                    <CloudUpload className="mr-2 h-4 w-4" />
                    Cloud
                  </Button>
                  <Button
                    aria-pressed={effectiveCreateMode === 'url'}
                    onClick={() => setCreateMode('url')}
                    size="sm"
                    type="button"
                    variant={effectiveCreateMode === 'url' ? 'default' : 'ghost'}
                  >
                    <LinkIcon className="mr-2 h-4 w-4" />
                    URL
                  </Button>
                </div>
              </div>

              {effectiveCreateMode === 'upload' || effectiveCreateMode === 'cloud_upload' ? (
                <div className="flex flex-col gap-2" key="asset-file-fields">
                  <Label htmlFor="asset-upload">Dosya</Label>
                  <Input
                    accept={getAssetAccept(createType)}
                    id="asset-upload"
                    onChange={handleFileChange}
                    type="file"
                  />
                  {selectedFile ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {selectedFile.name} / {formatFileSize(selectedFile.size)}
                    </p>
                  ) : null}
                  {effectiveCreateMode === 'cloud_upload' ? (
                    <p className="text-xs leading-5 text-muted-foreground">
                      Production için önerilen yol. Görseller optimize edilir; medya aktif Cloud Storage/CDN hedefinde saklanır.
                    </p>
                  ) : (
                    <p className="text-xs leading-5 text-muted-foreground">
                      Local geliştirme ve küçük kurulumlar için. Production ortamında Cloud Upload önerilir.
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2" key="asset-url-fields">
                  <Label htmlFor="asset-url">URL</Label>
                  <Input
                    id="asset-url"
                    onChange={(event) => setUrlValue(event.target.value)}
                    placeholder="https://cdn.example.com/story.png"
                    type="url"
                    value={urlValue}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-border/60 px-6 py-5 sm:flex-row sm:justify-end sm:px-8">
              <Button
                disabled={isCreating}
                onClick={() => handleCreateSheetChange(false)}
                type="button"
                variant="outline"
              >
                Vazgeç
              </Button>
              <Button disabled={isCreating} type="submit">
                <ImagePlus className="mr-2 h-4 w-4" />
                {isCreating ? 'Ekleniyor...' : 'Asset oluştur'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
