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
import { ImagePlus, RefreshCcw, Upload, X } from 'lucide-react';
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

type PickerMode = 'existing' | 'upload' | 'url';

function formatFileSize(sizeBytes: number | null): string {
  if (!sizeBytes || sizeBytes <= 0) {
    return 'Bilinmiyor';
  }

  if (sizeBytes < 1024 * 1024) {
    return `${Math.round(sizeBytes / 1024)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
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
      reject(new Error('Seçilen dosya için önizleme alınamadı.'));
    };

    image.src = objectUrl;
  });
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
        <div>
          <p className="font-medium">{asset.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{asset.id}</p>
        </div>
        <Badge variant={selected ? 'default' : 'secondary'}>{asset.source === 'upload' ? 'Upload' : 'URL'}</Badge>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-background">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={asset.name} className="h-full w-full object-cover" src={asset.url} />
        </div>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            {asset.width && asset.height ? `${asset.width}×${asset.height}` : 'Boyut bilinmiyor'}
          </p>
          <p>{formatFileSize(asset.sizeBytes)}</p>
        </div>
      </div>
    </button>
  );
}

export function LogoAssetPicker({
  value,
  onChange,
}: {
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

  const assetsQuery = useQuery({
    queryKey: ['assets', 'group_logo'],
    queryFn: () => apiRequest<AssetApiRecord[]>('/api/assets?type=group_logo'),
  });

  const selectedAsset = useMemo(
    () => assetsQuery.data?.find((asset) => asset.id === value) ?? null,
    [assetsQuery.data, value],
  );

  const uploadAssetMutation = useMutation({
    mutationFn: async (payload: { file: File; width: number; height: number }) => {
      const formData = new FormData();
      formData.set('type', 'group_logo');
      formData.set('file', payload.file);
      formData.set('width', String(payload.width));
      formData.set('height', String(payload.height));

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
      await queryClient.invalidateQueries({ queryKey: ['assets', 'group_logo'] });
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
          type: 'group_logo',
          url,
        }),
      }),
    onSuccess: async (asset) => {
      await queryClient.invalidateQueries({ queryKey: ['assets', 'group_logo'] });
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
      const { width, height, objectUrl } = await readImageMetaFromFile(file);
      try {
        if (width !== height) {
          setUploadError('Group logo kare olmalıdır.');
          return;
        }

        await uploadAssetMutation.mutateAsync({
          file,
          width,
          height,
        });
      } finally {
        URL.revokeObjectURL(objectUrl);
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={selectedAsset.name} className="h-full w-full object-cover" src={selectedAsset.url} />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <p className="font-medium">{selectedAsset.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedAsset.id}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {selectedAsset.width && selectedAsset.height
                      ? `${selectedAsset.width}×${selectedAsset.height}`
                      : 'Boyut bilinmiyor'}
                  </Badge>
                  <Badge variant="secondary">{selectedAsset.source === 'upload' ? 'Upload' : 'URL'}</Badge>
                </div>
              </div>
            </div>
          ) : value ? (
            <div className="space-y-2">
              <p className="font-medium">Seçili asset ID</p>
              <p className="text-xs text-muted-foreground">{value}</p>
              <p className="text-xs leading-5 text-muted-foreground">
                Asset listesinde eşleşen kayıt bulunamadı. Picker içinden yeni asset seçebilirsiniz.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="font-medium">Henüz logo asset seçilmedi</p>
              <p className="text-xs leading-5 text-muted-foreground">
                Mevcut asset seçebilir veya bilgisayarınızdan yeni bir asset yükleyebilirsiniz.
              </p>
            </div>
          )}
        </div>

        <DialogTrigger asChild>
          <Button className="gap-2" type="button" variant="outline">
            <ImagePlus className="h-4 w-4" />
            {selectedAsset || value ? 'Logo asset değiştir' : 'Logo asset seç'}
          </Button>
        </DialogTrigger>
      </div>

      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Logo seç</DialogTitle>
          <DialogDescription>
            Mevcut logolardan seçin veya yeni bir logo yükleyin.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setMode('existing')} type="button" variant={mode === 'existing' ? 'default' : 'outline'}>
            Mevcut assetler
          </Button>
          <Button onClick={() => setMode('upload')} type="button" variant={mode === 'upload' ? 'default' : 'outline'}>
            Bilgisayardan yükle
          </Button>
          <Button onClick={() => setMode('url')} type="button" variant={mode === 'url' ? 'default' : 'outline'}>
            URL ile içe al
          </Button>
        </div>

        {mode === 'existing' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Yalnızca grup logoları listelenir.</p>
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
                Henüz kayıtlı group logo asseti yok. Upload sekmesinden yeni asset oluşturun.
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

        {mode === 'upload' ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/60 border-dashed bg-muted/20 p-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium">Bilgisayardan kare logo yükle</p>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  JPG, PNG, WEBP veya SVG formatlarını yükleyebilirsiniz. Raster görseller için kare kontrolü yapılır.
                </p>
                <Input accept="image/*" onChange={handleFileChange} type="file" />
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
                  <p className="font-medium">Logo URL ile içe al</p>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Bir görsel bağlantısı girin. Görsel eklenip seçim listesine kaydedilir.
                </p>
                <Input
                  onChange={(event) => setUrlValue(event.target.value)}
                  placeholder="https://cdn.example.com/logo.png"
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
