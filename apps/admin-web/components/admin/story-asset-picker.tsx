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
import { Clapperboard, ImagePlus, Link2, RefreshCcw, Upload, X } from 'lucide-react';
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
  source: 'url' | 'upload';
  createdAt: string;
  updatedAt: string;
};

type PickerMode = 'existing' | 'url' | 'upload';
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
    urlPlaceholder: string;
    existingDescription: string;
    uploadDescription: string;
    accepts: string;
    previewKind: 'image' | 'video';
  }
> = {
  story_image: {
    title: 'Story image asset',
    buttonLabel: 'Story image seç',
    emptyLabel: 'Henüz story image seçilmedi',
    emptyDescription: '9:16 oranlı JPG, PNG veya WEBP görsel seçin; URL ile ekleyin veya yükleyin.',
    dialogTitle: 'Story image asset picker',
    dialogDescription: 'Story image assetlerini listeleyin veya 9:16 oranlı yeni bir görsel ekleyin.',
    urlPlaceholder: 'https://cdn.example.com/story-hero.webp',
    existingDescription: 'Yalnızca `story_image` assetleri listelenir.',
    uploadDescription: 'JPG, PNG veya WEBP formatında 9:16 story image yükleyin.',
    accepts: 'image/png,image/jpeg,image/webp',
    previewKind: 'image',
  },
  story_video: {
    title: 'Story video asset',
    buttonLabel: 'Story video seç',
    emptyLabel: 'Henüz story video seçilmedi',
    emptyDescription: '9:16 oranlı MP4 video seçin. Maksimum süre 30 saniye, maksimum boyut 50 MB olmalıdır.',
    dialogTitle: 'Story video asset picker',
    dialogDescription: 'Story video assetlerini yönetin. V1’de yalnızca MP4 video kabul edilir.',
    urlPlaceholder: 'https://cdn.example.com/story-video.mp4',
    existingDescription: 'Yalnızca `story_video` assetleri listelenir.',
    uploadDescription: 'MP4 formatında, 9:16 oranlı ve 30 saniyeyi aşmayan video yükleyin.',
    accepts: 'video/mp4',
    previewKind: 'video',
  },
  story_poster: {
    title: 'Story poster asset',
    buttonLabel: 'Poster seç',
    emptyLabel: 'Henüz poster asset seçilmedi',
    emptyDescription: 'Video story için 9:16 poster zorunludur. JPG, PNG veya WEBP poster seçin.',
    dialogTitle: 'Story poster asset picker',
    dialogDescription: 'Video poster assetlerini seçin veya yeni bir 9:16 poster oluşturun.',
    urlPlaceholder: 'https://cdn.example.com/story-poster.jpg',
    existingDescription: 'Yalnızca `story_poster` assetleri listelenir.',
    uploadDescription: 'JPG, PNG veya WEBP formatında 9:16 video poster yükleyin.',
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

function inferMimeTypeFromUrl(url: string): string | null {
  const normalizedUrl = url.toLowerCase();

  if (normalizedUrl.endsWith('.png')) {
    return 'image/png';
  }

  if (normalizedUrl.endsWith('.jpg') || normalizedUrl.endsWith('.jpeg')) {
    return 'image/jpeg';
  }

  if (normalizedUrl.endsWith('.webp')) {
    return 'image/webp';
  }

  if (normalizedUrl.endsWith('.mp4')) {
    return 'video/mp4';
  }

  return null;
}

function isAspectRatioMatch(width: number, height: number, targetWidth: number, targetHeight: number): boolean {
  return Math.abs(width / height - targetWidth / targetHeight) <= 0.03;
}

function readImageMetaFromUrl(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();

    image.onload = () => {
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };

    image.onerror = () => reject(new Error('Görsel metadata okunamadı.'));
    image.src = url;
  });
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

function validateImageLikeAsset(width: number, height: number): void {
  if (!isAspectRatioMatch(width, height, 9, 16)) {
    throw new Error('Story asset oranı 9:16 olmalıdır.');
  }
}

function validateVideoMetadata(width: number, height: number, durationMs: number): void {
  validateImageLikeAsset(width, height);

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
        <Badge variant={selected ? 'default' : 'secondary'}>{asset.source === 'upload' ? 'Upload' : 'URL'}</Badge>
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
  const [urlValue, setUrlValue] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const config = ASSET_TYPE_CONFIG[assetType];

  const assetsQuery = useQuery({
    queryKey: ['assets', assetType],
    queryFn: () => apiRequest<AssetApiRecord[]>(`/api/assets?type=${assetType}`),
  });

  const selectedAsset = useMemo(
    () => assetsQuery.data?.find((asset) => asset.id === value) ?? null,
    [assetsQuery.data, value],
  );

  const createUrlAssetMutation = useMutation({
    mutationFn: (payload: {
      url: string;
      mimeType: string | null;
      width: number | null;
      height: number | null;
    }) =>
      apiRequest<AssetApiRecord>('/api/assets', {
        method: 'POST',
        body: JSON.stringify({
          type: assetType,
          url: payload.url,
          mimeType: payload.mimeType,
          width: payload.width,
          height: payload.height,
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

  const uploadAssetMutation = useMutation({
    mutationFn: async (payload: { file: File; width: number | null; height: number | null }) => {
      const formData = new FormData();
      formData.set('type', assetType);
      formData.set('file', payload.file);

      if (payload.width !== null) {
        formData.set('width', String(payload.width));
      }

      if (payload.height !== null) {
        formData.set('height', String(payload.height));
      }

      const response = await fetch('/api/assets', {
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

  const handleCreateFromUrl = async () => {
    setUrlError(null);

    try {
      const normalizedUrl = urlValue.trim();

      if (!normalizedUrl) {
        setUrlError('Asset URL zorunludur.');
        return;
      }

      const mimeType = inferMimeTypeFromUrl(normalizedUrl);
      let width: number | null = null;
      let height: number | null = null;

      if (config.previewKind === 'image') {
        const imageMeta = await readImageMetaFromUrl(normalizedUrl);
        validateImageLikeAsset(imageMeta.width, imageMeta.height);
        width = imageMeta.width;
        height = imageMeta.height;
      } else {
        const videoMeta = await readVideoMetaFromSource(normalizedUrl);
        validateVideoMetadata(videoMeta.width, videoMeta.height, videoMeta.durationMs);
        width = videoMeta.width;
        height = videoMeta.height;

        if (mimeType !== 'video/mp4') {
          throw new Error('Video URL `.mp4` uzantılı olmalıdır.');
        }
      }

      await createUrlAssetMutation.mutateAsync({
        url: normalizedUrl,
        mimeType,
        width,
        height,
      });
    } catch (error) {
      setUrlError(error instanceof Error ? error.message : 'URL ile asset eklenemedi.');
    }
  };

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
          validateImageLikeAsset(width, height);

          await uploadAssetMutation.mutateAsync({
            file,
            width,
            height,
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

          validateVideoMetadata(width, height, durationMs);

          await uploadAssetMutation.mutateAsync({
            file,
            width,
            height,
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
                  <Badge variant="secondary">{selectedAsset.source === 'upload' ? 'Upload' : 'URL'}</Badge>
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
          <Button onClick={() => setMode('url')} type="button" variant={mode === 'url' ? 'default' : 'outline'}>
            URL ile ekle
          </Button>
          <Button onClick={() => setMode('upload')} type="button" variant={mode === 'upload' ? 'default' : 'outline'}>
            Bilgisayardan yükle
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
                Bu tip için henüz kayıtlı asset yok. URL veya upload sekmesinden yeni asset oluşturun.
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

        {mode === 'url' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor={`${assetType}-asset-url`}>
                Asset URL
              </label>
              <Input
                id={`${assetType}-asset-url`}
                onChange={(event) => setUrlValue(event.target.value)}
                placeholder={config.urlPlaceholder}
                value={urlValue}
              />
              <p className="text-xs leading-5 text-muted-foreground">
                {config.previewKind === 'video'
                  ? 'Public MP4 URL girin. Video için 9:16 oran ve 30 saniye sınırı doğrulanır.'
                  : 'Public görsel URL girin. Story asset oranı 9:16 olarak doğrulanır.'}
              </p>
            </div>

            {urlError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {urlError}
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button
                className="gap-2"
                disabled={createUrlAssetMutation.isPending}
                onClick={handleCreateFromUrl}
                type="button"
              >
                <Link2 className="h-4 w-4" />
                {createUrlAssetMutation.isPending ? 'Ekleniyor...' : 'URL ile asset oluştur'}
              </Button>
            </div>
          </div>
        ) : null}

        {mode === 'upload' ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/60 border-dashed bg-muted/20 p-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium">{config.title} yükle</p>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{config.uploadDescription}</p>
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
      </DialogContent>
    </Dialog>
  );
}
