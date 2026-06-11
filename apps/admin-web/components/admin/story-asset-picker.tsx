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
import { ChangeEvent, useEffect, useMemo, useState } from 'react';

import { ApiRequestError, apiRequest } from '@/lib/api';
import { ASSET_UPLOAD_CAPABILITIES_QUERY_KEY, AssetUploadCapabilitiesDto, canUseServerAssetUpload } from '@/lib/asset-storage-settings';

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
    title: 'Story image',
    buttonLabel: 'Select story image',
    emptyLabel: 'No story image selected yet',
    emptyDescription: 'Select or upload a JPG, PNG, or WEBP image. 9:16 is recommended; other ratios are accepted.',
    dialogTitle: 'Select story image',
    dialogDescription: 'Select an existing image or upload a new one.',
    existingDescription: 'Registered story images are listed.',
    uploadDescription: 'Upload a JPG, PNG, or WEBP image. 9:16 is recommended.',
    accepts: 'image/png,image/jpeg,image/webp',
    previewKind: 'image',
  },
  story_video: {
    title: 'Story videosu',
    buttonLabel: 'Select story video',
    emptyLabel: 'No story video selected yet',
    emptyDescription: 'Select an MP4 video. 9:16 is recommended; maximum duration is 30 seconds and maximum size is 50 MB.',
    dialogTitle: 'Select story video',
    dialogDescription: 'Select an existing video or upload a new one.',
    existingDescription: 'Registered story videos are listed.',
    uploadDescription: 'Upload an MP4 video up to 30 seconds. 9:16 is recommended.',
    accepts: 'video/mp4',
    previewKind: 'video',
  },
  story_poster: {
    title: 'Poster',
    buttonLabel: 'Select poster',
    emptyLabel: 'No poster selected yet',
    emptyDescription: 'A poster is required for video stories. Select a JPG, PNG, or WEBP poster; 9:16 is recommended.',
    dialogTitle: 'Select poster',
    dialogDescription: 'Select an existing poster or upload a new one.',
    existingDescription: 'Registered posters are listed.',
    uploadDescription: 'Upload a JPG, PNG, or WEBP video poster. 9:16 is recommended.',
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
      reject(new Error('Image metadata could not be read.'));
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
        reject(new Error('Video duration could not be read.'));
        return;
      }

      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        durationMs,
      });
    };

    const handleError = () => reject(new Error('Video metadata could not be read.'));

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
    throw new Error('Video duration can be at most 30 seconds.');
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
    queryFn: () => apiRequest<AssetApiRecord[]>(`/api/assets?type=${assetType}&include_usage=false`),
  });
  const storageSettingsQuery = useQuery({
    queryKey: ASSET_UPLOAD_CAPABILITIES_QUERY_KEY,
    queryFn: () => apiRequest<AssetUploadCapabilitiesDto>('/api/assets/upload-capabilities'),
  });
  const serverUploadAllowed = canUseServerAssetUpload(storageSettingsQuery.data);

  useEffect(() => {
    if (!serverUploadAllowed && mode === 'upload') {
      setMode('cloud_upload');
    }
  }, [mode, serverUploadAllowed]);
  const effectiveMode = mode === 'upload' && !serverUploadAllowed ? 'cloud_upload' : mode;

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
          payloadJson?.error?.message ?? `Upload failed (${response.status}).`,
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
            storage: effectiveMode === 'cloud_upload' ? 'cloud' : 'local',
          });
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      } else {
        if (file.size > 50 * 1024 * 1024) {
          throw new Error('Video file cannot exceed the 50 MB limit.');
        }

        const { width, height, durationMs, objectUrl } = await readVideoMetaFromFile(file);

        try {
          if (file.type && file.type !== 'video/mp4') {
            throw new Error('Only MP4 videos can be uploaded.');
          }

          validateVideoMetadata(durationMs);

          await uploadAssetMutation.mutateAsync({
            file,
            width,
            height,
            storage: effectiveMode === 'cloud_upload' ? 'cloud' : 'local',
          });
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'File could not be uploaded.');
    } finally {
      event.target.value = '';
    }
  };

  const handleUrlImport = async () => {
    setUrlError(null);

    if (!urlValue.trim()) {
      setUrlError('Asset URL is required.');
      return;
    }

    try {
      await importAssetFromUrlMutation.mutateAsync(urlValue.trim());
    } catch (error) {
      setUrlError(error instanceof Error ? error.message : 'Asset could not be imported by URL.');
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
              <p className="font-medium">Selected asset ID</p>
              <p className="truncate text-xs text-muted-foreground">{value}</p>
              <p className="text-xs leading-5 text-muted-foreground">
                No matching record was found in the asset list. You can select a new asset from the picker.
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
            {selectedAsset || value ? `Change ${config.title}` : config.buttonLabel}
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
          {serverUploadAllowed ? (
            <Button onClick={() => setMode('upload')} type="button" variant={effectiveMode === 'upload' ? 'default' : 'outline'}>
              Upload from computer
            </Button>
          ) : null}
          <Button
            onClick={() => setMode('cloud_upload')}
            type="button"
            variant={effectiveMode === 'cloud_upload' ? 'default' : 'outline'}
          >
            Upload to CDN
          </Button>
          <Button onClick={() => setMode('url')} type="button" variant={effectiveMode === 'url' ? 'default' : 'outline'}>
            Import by URL
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
                Refresh
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
                {(assetsQuery.error as Error | undefined)?.message ?? 'Asset list could not be loaded.'}
              </div>
            ) : (assetsQuery.data?.length ?? 0) === 0 ? (
              <div className="rounded-lg border border-border/60 border-dashed px-4 py-8 text-sm text-muted-foreground">
                No registered assets exist for this type yet. Create a new asset from the Upload tab.
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

        {effectiveMode === 'upload' || effectiveMode === 'cloud_upload' ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/60 border-dashed bg-muted/20 p-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {effectiveMode === 'cloud_upload' ? (
                    <CloudUpload className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Upload className="h-4 w-4 text-muted-foreground" />
                  )}
                  <p className="font-medium">
                    {effectiveMode === 'cloud_upload' ? `Upload ${config.title} to CDN` : `Upload ${config.title}`}
                  </p>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {effectiveMode === 'cloud_upload'
                    ? 'Recommended for production. Images are optimized; media is stored in the active Cloud Storage/CDN target.'
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
              <div className="text-sm text-muted-foreground">Uploading file...</div>
            ) : null}
          </div>
        ) : null}

        {mode === 'url' ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/60 border-dashed bg-muted/20 p-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ImagePlus className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium">Import {config.title} by URL</p>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Enter a file link. The file is added and saved to the selection list.
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
                  Import by URL
                </Button>
              </div>
            </div>

            {urlError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {urlError}
              </div>
            ) : null}

            {importAssetFromUrlMutation.isPending ? (
              <div className="text-sm text-muted-foreground">Importing from URL...</div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
