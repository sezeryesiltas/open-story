'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@open-story/ui/components/badge';
import { Button } from '@open-story/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@open-story/ui/components/card';
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@open-story/ui/components/select';
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
  Clapperboard,
  CloudUpload,
  Eye,
  ImagePlus,
  LinkIcon,
  RefreshCcw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { ChangeEvent, useMemo, useState } from 'react';

import { PageHeader } from '@/components/admin/page-header';
import { ApiRequestError, apiRequest } from '@/lib/api';

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
  const uploadCount = assets.filter((asset) => asset.source === 'upload').length;
  const cloudUploadCount = assets.filter((asset) => asset.source === 'cloud_upload').length;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Card className="border-border/60 bg-card/80">
        <CardHeader className="pb-2">
          <p className="text-sm font-medium text-muted-foreground">Toplam</p>
          <CardTitle className="text-2xl">{assets.length}</CardTitle>
        </CardHeader>
      </Card>
      <Card className="border-border/60 bg-card/80">
        <CardHeader className="pb-2">
          <p className="text-sm font-medium text-muted-foreground">Kullanılan</p>
          <CardTitle className="text-2xl">{usedCount}</CardTitle>
        </CardHeader>
      </Card>
      <Card className="border-border/60 bg-card/80">
        <CardHeader className="pb-2">
          <p className="text-sm font-medium text-muted-foreground">Kullanılmayan / Upload / Cloud</p>
          <CardTitle className="text-2xl">
            {unusedCount} / {uploadCount} / {cloudUploadCount}
          </CardTitle>
        </CardHeader>
      </Card>
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

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setCreateError(null);
    setSelectedFile(event.target.files?.[0] ?? null);
  };

  const handleCreate = async () => {
    setCreateError(null);

    try {
      if (createMode === 'upload' || createMode === 'cloud_upload') {
        if (!selectedFile) {
          setCreateError('Upload için dosya seçin.');
          return;
        }

        await uploadAssetMutation.mutateAsync({
          type: createType,
          file: selectedFile,
          storage: createMode === 'cloud_upload' ? 'cloud' : 'local',
        });
        return;
      }

      if (!urlValue.trim()) {
        setCreateError('URL ile eklemek için asset URL girin.');
        return;
      }

      await importAssetMutation.mutateAsync({ type: createType, url: urlValue.trim() });
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
          <Button
            disabled={assetsQuery.isFetching}
            onClick={() => assetsQuery.refetch()}
            size="sm"
            type="button"
            variant="outline"
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Yenile
          </Button>
        }
        title="Assets"
      />

      <AssetStats assets={assets} />

      <div className="flex flex-col gap-6">
        <Card className="order-2 border-border/60 bg-card/80">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Asset listesi</CardTitle>
              </div>
              {typeFilter !== 'all' || usageFilter !== 'all' || sourceFilter !== 'all' || searchValue ? (
                <Button onClick={resetFilters} size="sm" type="button" variant="ghost">
                  Filtreleri temizle
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_180px_160px_160px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="İsim, ID veya URL ara"
                  value={searchValue}
                />
              </div>

              <Select onValueChange={(value) => setTypeFilter(value as AssetType | 'all')} value={typeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tip" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm tipler</SelectItem>
                  {ASSET_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select onValueChange={(value) => setUsageFilter(value as UsageFilter)} value={usageFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Kullanım" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm kullanım</SelectItem>
                  <SelectItem value="used">Kullanılan</SelectItem>
                  <SelectItem value="unused">Kullanılmayan</SelectItem>
                </SelectContent>
              </Select>

              <Select onValueChange={(value) => setSourceFilter(value as SourceFilter)} value={sourceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Kaynak" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm kaynaklar</SelectItem>
                  <SelectItem value="upload">Server Upload</SelectItem>
                  <SelectItem value="cloud_upload">Cloud Upload</SelectItem>
                  <SelectItem value="url">URL</SelectItem>
                </SelectContent>
              </Select>
            </div>

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

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead>Metadata</TableHead>
                  <TableHead>Kullanım</TableHead>
                  <TableHead>Kaynak</TableHead>
                  <TableHead>Oluşturma</TableHead>
                  <TableHead className="text-right">Aksiyon</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssets.length === 0 ? <EmptyRows isLoading={assetsQuery.isLoading} /> : null}
                {filteredAssets.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell>
                      <div className="flex min-w-[220px] items-center gap-3">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-background">
                          <AssetPreview asset={asset} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{asset.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{asset.id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{getAssetTypeLabel(asset.type)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p>{asset.width && asset.height ? `${asset.width}x${asset.height}` : 'Boyut bilinmiyor'}</p>
                        <p>{formatFileSize(asset.sizeBytes)}</p>
                        {formatDuration(asset.durationMs) ? <p>{formatDuration(asset.durationMs)}</p> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant={asset.usageCount > 0 ? 'default' : 'outline'}>
                          {asset.usageCount > 0 ? `${asset.usageCount} referans` : 'Kullanılmıyor'}
                        </Badge>
                        {asset.usageReferences[0] ? (
                          <p className="max-w-[220px] truncate text-xs text-muted-foreground">
                            {asset.usageReferences[0].name}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getAssetSourceLabel(asset.source)}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(asset.createdAt)}</TableCell>
                    <TableCell>
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
                          disabled={asset.usageCount > 0 || deleteAssetMutation.isPending}
                          onClick={() => handleDelete(asset)}
                          size="icon"
                          type="button"
                          variant="outline"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Sil</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="order-1 border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Yeni asset</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <Label>Tip</Label>
                  <Select onValueChange={(value) => setCreateType(value as AssetType)} value={createType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Asset tipi" />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSET_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-lg border border-border/60 bg-muted/20 p-1">
                  <Button
                    onClick={() => setCreateMode('upload')}
                    size="sm"
                    type="button"
                    variant={createMode === 'upload' ? 'default' : 'ghost'}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Server
                  </Button>
                  <Button
                    onClick={() => setCreateMode('cloud_upload')}
                    size="sm"
                    type="button"
                    variant={createMode === 'cloud_upload' ? 'default' : 'ghost'}
                  >
                    <CloudUpload className="mr-2 h-4 w-4" />
                    Cloud
                  </Button>
                  <Button
                    onClick={() => setCreateMode('url')}
                    size="sm"
                    type="button"
                    variant={createMode === 'url' ? 'default' : 'ghost'}
                  >
                    <LinkIcon className="mr-2 h-4 w-4" />
                    URL
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {createMode === 'upload' || createMode === 'cloud_upload' ? (
                  <div className="flex flex-col gap-2">
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
                    {createMode === 'cloud_upload' ? (
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
                  <div className="flex flex-col gap-2">
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

                <Button className="w-full" disabled={isCreating} onClick={handleCreate} type="button">
                  <ImagePlus className="mr-2 h-4 w-4" />
                  {isCreating ? 'Ekleniyor' : 'Asset ekle'}
                </Button>
              </div>
            </div>

            {createError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {createError}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
