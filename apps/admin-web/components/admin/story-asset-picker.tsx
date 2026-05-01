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
import { Skeleton } from '@open-story/ui/components/skeleton';
import { Clapperboard, CloudUpload, ImagePlus, RefreshCcw, Upload, X } from 'lucide-react';
import { ChangeEvent, useMemo, useState } from 'react';

import { ApiRequestError, apiRequest } from '@/lib/api';

type AssetApiRecord = {
  id: string;
  type: 'group_logo' | 'story_image' | 'story_video' | 'story_poster';
  url: string;
  name: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  source: AssetSource;
  createdAt: string;
  updatedAt: string;
};

type AssetSource = 'upload' | 'url' | 'cloud_upload';
type PickerMode = 'existing' | 'upload' | 'cloud_upload' | 'url';
type StoryAssetType = 'story_image' | 'story_video' | 'story_poster';

const ASSET_TYPE_CONFIG: Record<
  StoryAssetType,
  {
    title: string;
    buttonLabel: string;
    emptyLabel: string;
    emptyDescription: string;
    dialogTitle: string;
    dialogDescription: string;
    existingDescription: string;
    uploadDescription: string;
    accepts: string;
    previewKind: 'image' | 'video';
  }
> = {
  story_image: {
    title: 'Story görseli',
    buttonLabel: 'Story görseli seç',
    emptyLabel: 'Henüz story görseli seçilmedi',
    emptyDescription: 'JPG, PNG veya WEBP görsel seçin ya da yükleyin. 9:16 oran önerilir, farklı oranlar kabul edilir.',
    dialogTitle: 'Story görseli seç',
    dialogDescription: 'Mevcut görselleri seçin veya yeni bir görsel yükleyin.',
    existingDescription: 'Kayıtlı story görselleri listelenir.',
    uploadDescription: 'JPG, PNG veya WEBP formatında görsel yükleyin. 9:16 oran önerilir.',
    accepts: 'image/png,image/jpeg,image/webp',
    previewKind: 'image',
  },
  story_video: {
    title: 'Story videosu',
    buttonLabel: 'Story videosu seç',
    emptyLabel: 'Henüz story videosu seçilmedi',
    emptyDescription: 'MP4 video seçin. 9:16 oran önerilir; maksimum süre 30 saniye, maksimum boyut 50 MB olmalıdır.',
    dialogTitle: 'Story videosu seç',
    dialogDescription: 'Mevcut videoları seçin veya yeni bir video yükleyin.',
    existingDescription: 'Kayıtlı story videoları listelenir.',
    uploadDescription: 'MP4 formatında ve 30 saniyeyi aşmayan video yükleyin. 9:16 oran önerilir.',
    accepts: 'video/mp4',
    previewKind: 'video',
  },
  story_poster: {
    title: 'Poster',
    buttonLabel: 'Poster seç',
    emptyLabel: 'Henüz poster seçilmedi',
    emptyDescription: 'Video story için poster zorunludur. JPG, PNG veya WEBP poster seçin; 9:16 oran önerilir.',
    dialogTitle: 'Poster seç',
    dialogDescription: 'Mevcut posterleri seçin veya yeni bir poster yükleyin.',
    existingDescription: 'Kayıtlı posterler listelenir.',
    uploadDescription: 'JPG, PNG veya WEBP formatında video poster yükleyin. 9:16 oran önerilir.',
    accepts: 'image/png,image/jpeg,image/webp',
    previewKind: 'image',
  },
};

function formatFileSize(sizeBytes: number | null): string {
  if (!sizeBytes || sizeBytes <= 0) {
    return 'Bilinmiyor';
  }

  if (sizeBytes < 1024 * 1024) {
    return `${Math.round(sizeBytes / 1024)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getAssetSourceLabel(source: AssetSource): string {
  if (source === 'cloud_upload') {
    return 'Cloud Upload';
  }

  return source === 'upload' ? 'Server Upload' : 'URL';
}

function readImageMetaFromFile(file: File): Promise<{ width: number; height: number; objectUrl: string }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();

    image.onload = () => {
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
        objectUrl,
      });
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Görsel metadata okunamadı.'));
    };

    image.src = objectUrl;
  });
}

function readVideoMetaFromSource(source: string): Promise<{ width: number; height: number; durationMs: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';

    const handleLoadedMetadata = () => {
      const durationMs = Math.round(video.duration * 1000);

      if (!Number.isFinite(durationMs) || durationMs <= 0) {
        reject(new Error('Video süresi okunamadı.'));
        return;
      }

      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        durationMs,
      });
    };

    const handleError = () => reject(new Error('Video metadata okunamadı.'));

    video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
    video.addEventListener('error', handleError, { once: true });
    video.src = source;
  });
}

async function readVideoMetaFromFile(file: File): Promise<{
  width: number;
  height: number;
  durationMs: number;
  objectUrl: string;
}> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const metadata = await readVideoMetaFromSource(objectUrl);
    return {
      ...metadata,
      objectUrl,
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

function validateVideoMetadata(durationMs: number): void {
  if (durationMs > 30_000) {
    throw new Error('Video süresi en fazla 30 saniye olabilir.');
  }
}

function AssetPreview({ asset }: { asset: AssetApiRecord }) {
  if (asset.type === 'story_video') {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted/20 text-muted-foreground">
        <Clapperboard className="h-5 w-5" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={asset.name} className="h-full w-full object-cover" src={asset.url} />
  );
}

function AssetCard({
  asset,
  selected,
  onSelect,
}: {
  asset: AssetApiRecord;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={`flex w-full flex-col gap-3 rounded-xl border p-3 text-left transition-colors ${
        selected ? 'border-primary bg-primary/5' : 'border-border/60 bg-muted/20 hover:bg-muted/30'
      }`}
      onClick={onSelect}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{asset.name}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{asset.id}</p>
        </div>
        <Badge variant={selected ? 'default' : 'secondary'}>{getAssetSourceLabel(asset.source)}</Badge>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-background">
          <AssetPreview asset={asset} />
        </div>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>{asset.width && asset.height ? `${asset.width}×${asset.height}` : 'Boyut bilinmiyor'}</p>
          <p>{formatFileSize(asset.sizeBytes)}</p>
          {asset.mimeType ? <p>{asset.mimeType}</p> : null}
        </div>
      </div>
    </button>
  );
}

export function StoryAssetPicker({
  assetType,
  value,
  onChange,
}: {
  assetType: StoryAssetType;
  value: string;
  onChange: (asset: AssetApiRecord) => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PickerMode>('existing');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [urlValue, setUrlValue] = useState('');
  const config = ASSET_TYPE_CONFIG[assetType];

  const assetsQuery = useQuery({
    queryKey: ['assets', assetType],
    queryFn: () => apiRequest<AssetApiRecord[]>(`/api/assets?type=${assetType}`),
  });

  const selectedAsset = useMemo(
    () => assetsQuery.data?.find((asset) => asset.id === value) ?? null,
    [assetsQuery.data, value],
  );

  const uploadAssetMutation = useMutation({
    mutationFn: async (payload: { file: File; width: number | null; height: number | null; storage: 'local' | 'cloud' }) => {
      const formData = new FormData();
      formData.set('type', assetType);
      formData.set('file', payload.file);

      if (payload.width !== null) {
        formData.set('width', String(payload.width));
      }

      if (payload.height !== null) {
        formData.set('height', String(payload.height));
      }

      const response = await fetch(payload.storage === 'cloud' ? '/api/assets?storage=cloud' : '/api/assets', {
        method: 'POST',
        body: formData,
      });

      const contentType = response.headers.get('content-type') ?? '';
      const payloadJson = contentType.includes('application/json') ? await response.json().catch(() => null) : null;

      if (!response.ok) {
        throw new ApiRequestError(
          payloadJson?.error?.message ?? `Upload başarısız oldu (${response.status}).`,
          response.status,
          payloadJson?.error?.code,
        );
      }

      return payloadJson as AssetApiRecord;
    },
    onSuccess: async (asset) => {
      await queryClient.invalidateQueries({ queryKey: ['assets', assetType] });
      onChange(asset);
      setOpen(false);
      setSelectedFileName(null);
      setUploadError(null);
    },
  });

  const importAssetFromUrlMutation = useMutation({
    mutationFn: async (url: string) =>
      apiRequest<AssetApiRecord>('/api/assets', {
        method: 'POST',
        body: JSON.stringify({
          type: assetType,
          url,
        }),
      }),
    onSuccess: async (asset) => {
      await queryClient.invalidateQueries({ queryKey: ['assets', assetType] });
      onChange(asset);
      setOpen(false);
      setUrlValue('');
      setUrlError(null);
    },
  });

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setSelectedFileName(file.name);

    try {
      if (config.previewKind === 'image') {
        const { width, height, objectUrl } = await readImageMetaFromFile(file);

        try {
          await uploadAssetMutation.mutateAsync({
            file,
            width,
            height,
            storage: mode === 'cloud_upload' ? 'cloud' : 'local',
          });
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      } else {
        if (file.size > 50 * 1024 * 1024) {
          throw new Error('Video dosyası 50 MB sınırını aşamaz.');
        }

        const { width, height, durationMs, objectUrl } = await readVideoMetaFromFile(file);

        try {
          if (file.type && file.type !== 'video/mp4') {
            throw new Error('Yalnızca MP4 video yüklenebilir.');
          }

          validateVideoMetadata(durationMs);

          await uploadAssetMutation.mutateAsync({
            file,
            width,
            height,
            storage: mode === 'cloud_upload' ? 'cloud' : 'local',
          });
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Dosya yüklenemedi.');
    } finally {
      event.target.value = '';
    }
  };

  const handleUrlImport = async () => {
    setUrlError(null);

    if (!urlValue.trim()) {
      setUrlError('Asset URL zorunludur.');
      return;
    }

    try {
      await importAssetFromUrlMutation.mutateAsync(urlValue.trim());
    } catch (error) {
      setUrlError(error instanceof Error ? error.message : 'Asset URL ile içe alınamadı.');
    }
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <div className="space-y-3">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
          {selectedAsset ? (
            <div className="flex items-start gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-background">
                <AssetPreview asset={selectedAsset} />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <p className="font-medium">{selectedAsset.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{selectedAsset.id}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {selectedAsset.width && selectedAsset.height
                      ? `${selectedAsset.width}×${selectedAsset.height}`
                      : 'Boyut bilinmiyor'}
                  </Badge>
                  <Badge variant="secondary">{formatFileSize(selectedAsset.sizeBytes)}</Badge>
                  <Badge variant="secondary">{getAssetSourceLabel(selectedAsset.source)}</Badge>
                </div>
              </div>
            </div>
          ) : value ? (
            <div className="space-y-2">
              <p className="font-medium">Seçili asset ID</p>
              <p className="truncate text-xs text-muted-foreground">{value}</p>
              <p className="text-xs leading-5 text-muted-foreground">
                Asset listesinde eşleşen kayıt bulunamadı. Picker içinden yeni asset seçebilirsiniz.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="font-medium">{config.emptyLabel}</p>
              <p className="text-xs leading-5 text-muted-foreground">{config.emptyDescription}</p>
            </div>
          )}
        </div>

        <DialogTrigger asChild>
          <Button className="gap-2" type="button" variant="outline">
            <ImagePlus className="h-4 w-4" />
            {selectedAsset || value ? `${config.title} değiştir` : config.buttonLabel}
          </Button>
        </DialogTrigger>
      </div>

      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{config.dialogTitle}</DialogTitle>
          <DialogDescription>{config.dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setMode('existing')} type="button" variant={mode === 'existing' ? 'default' : 'outline'}>
            Mevcut assetler
          </Button>
          <Button onClick={() => setMode('upload')} type="button" variant={mode === 'upload' ? 'default' : 'outline'}>
            Bilgisayardan yükle
          </Button>
          <Button
            onClick={() => setMode('cloud_upload')}
            type="button"
            variant={mode === 'cloud_upload' ? 'default' : 'outline'}
          >
            CDN&apos;e yükle
          </Button>
          <Button onClick={() => setMode('url')} type="button" variant={mode === 'url' ? 'default' : 'outline'}>
            URL ile içe al
          </Button>
        </div>

        {mode === 'existing' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{config.existingDescription}</p>
              <Button
                className="gap-2"
                onClick={() => assetsQuery.refetch()}
                size="sm"
                type="button"
                variant="outline"
              >
                <RefreshCcw className="h-4 w-4" />
                Yenile
              </Button>
            </div>

            {assetsQuery.isLoading ? (
              <div className="grid gap-3 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton className="h-32 w-full rounded-xl" key={index} />
                ))}
              </div>
            ) : assetsQuery.isError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {(assetsQuery.error as Error | undefined)?.message ?? 'Asset listesi yüklenemedi.'}
              </div>
            ) : (assetsQuery.data?.length ?? 0) === 0 ? (
              <div className="rounded-lg border border-border/60 border-dashed px-4 py-8 text-sm text-muted-foreground">
                Bu tip için henüz kayıtlı asset yok. Upload sekmesinden yeni asset oluşturun.
              </div>
            ) : (
              <div className="grid max-h-[420px] gap-3 overflow-y-auto md:grid-cols-2">
                {assetsQuery.data?.map((asset) => (
                  <AssetCard
                    asset={asset}
                    key={asset.id}
                    onSelect={() => {
                      onChange(asset);
                      setOpen(false);
                    }}
                    selected={asset.id === value}
                  />
                ))}
              </div>
            )}
          </div>
        ) : null}

        {mode === 'upload' || mode === 'cloud_upload' ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/60 border-dashed bg-muted/20 p-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {mode === 'cloud_upload' ? (
                    <CloudUpload className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Upload className="h-4 w-4 text-muted-foreground" />
                  )}
                  <p className="font-medium">
                    {mode === 'cloud_upload' ? `${config.title} CDN'e yükle` : `${config.title} yükle`}
                  </p>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {mode === 'cloud_upload'
                    ? 'Production için önerilir. Görseller optimize edilir; medya aktif Cloud Storage/CDN hedefinde saklanır.'
                    : config.uploadDescription}
                </p>
                <Input accept={config.accepts} onChange={handleFileChange} type="file" />
                {selectedFileName ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{selectedFileName}</span>
                    <button className="rounded-sm p-0.5 hover:bg-foreground/10" onClick={() => setSelectedFileName(null)} type="button">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            {uploadError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {uploadError}
              </div>
            ) : null}

            {uploadAssetMutation.isPending ? (
              <div className="text-sm text-muted-foreground">Dosya yükleniyor...</div>
            ) : null}
          </div>
        ) : null}

        {mode === 'url' ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/60 border-dashed bg-muted/20 p-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ImagePlus className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium">{config.title} URL ile içe al</p>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Bir dosya bağlantısı girin. Dosya eklenip seçim listesine kaydedilir.
                </p>
                <Input
                  onChange={(event) => setUrlValue(event.target.value)}
                  placeholder={
                    assetType === 'story_video'
                      ? 'https://cdn.example.com/story.mp4'
                      : 'https://cdn.example.com/story.png'
                  }
                  type="url"
                  value={urlValue}
                />
                <Button
                  className="w-full"
                  onClick={() => void handleUrlImport()}
                  type="button"
                  variant="outline"
                >
                  URL ile içe al
                </Button>
              </div>
            </div>

            {urlError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {urlError}
              </div>
            ) : null}

            {importAssetFromUrlMutation.isPending ? (
              <div className="text-sm text-muted-foreground">URL&apos;den içe aktarılıyor...</div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
