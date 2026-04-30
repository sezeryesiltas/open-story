'use client';

import type {
  AssetStorageSettingsDto,
  TestAssetStorageConnectionResponseDto,
  UpdateAssetStorageSettingsDto,
} from '@open-story/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@open-story/ui/components/badge';
import { Button } from '@open-story/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@open-story/ui/components/card';
import { Input } from '@open-story/ui/components/input';
import { Label } from '@open-story/ui/components/label';
import { Skeleton } from '@open-story/ui/components/skeleton';
import { Cloud, HardDrive, RefreshCcw, Save, TestTube2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/admin/page-header';
import { ApiRequestError, apiRequest } from '@/lib/api';

type Notice = {
  tone: 'success' | 'error';
  message: string;
};

type FormValues = {
  projectId: string;
  bucketName: string;
  objectPrefix: string;
  publicAssetBaseUrl: string;
  cacheControl: string;
};

const DEFAULT_FORM_VALUES: FormValues = {
  projectId: '',
  bucketName: '',
  objectPrefix: 'assets',
  publicAssetBaseUrl: '',
  cacheControl: 'public, max-age=31536000, immutable',
};

function toFormValues(settings: AssetStorageSettingsDto): FormValues {
  return {
    projectId: settings.gcs.projectId ?? '',
    bucketName: settings.gcs.bucketName ?? '',
    objectPrefix: settings.gcs.objectPrefix,
    publicAssetBaseUrl: settings.gcs.publicAssetBaseUrl ?? '',
    cacheControl: settings.gcs.cacheControl,
  };
}

function toPayload(values: FormValues): UpdateAssetStorageSettingsDto {
  return {
    activeProvider: 'gcs',
    gcs: {
      projectId: values.projectId.trim() || null,
      bucketName: values.bucketName.trim() || null,
      objectPrefix: values.objectPrefix.trim() || 'assets',
      publicAssetBaseUrl: values.publicAssetBaseUrl.trim() || null,
      cacheControl: values.cacheControl.trim() || DEFAULT_FORM_VALUES.cacheControl,
    },
  };
}

export function StorageSettingsWorkspace() {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<FormValues>(DEFAULT_FORM_VALUES);
  const [notice, setNotice] = useState<Notice | null>(null);

  const settingsQuery = useQuery({
    queryKey: ['asset-storage-settings'],
    queryFn: () => apiRequest<AssetStorageSettingsDto>('/api/settings/storage'),
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setValues(toFormValues(settingsQuery.data));
    }
  }, [settingsQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateAssetStorageSettingsDto) =>
      apiRequest<AssetStorageSettingsDto>('/api/settings/storage', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: (settings) => {
      queryClient.setQueryData(['asset-storage-settings'], settings);
      setValues(toFormValues(settings));
      setNotice({
        tone: 'success',
        message: 'Storage ayarları güncellendi.',
      });
    },
    onError: (error) => {
      setNotice({
        tone: 'error',
        message:
          error instanceof ApiRequestError || error instanceof Error
            ? error.message
            : 'Storage ayarları güncellenemedi.',
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: (payload: UpdateAssetStorageSettingsDto) =>
      apiRequest<TestAssetStorageConnectionResponseDto>('/api/settings/storage/test', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (result) => {
      setNotice({
        tone: result.ok ? 'success' : 'error',
        message: result.message,
      });
    },
    onError: (error) => {
      setNotice({
        tone: 'error',
        message:
          error instanceof ApiRequestError || error instanceof Error
            ? error.message
            : 'Storage bağlantısı test edilemedi.',
      });
    },
  });

  const updateField = (field: keyof FormValues, value: string) => {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
    setNotice(null);
  };

  const payload = toPayload(values);
  const isBusy = updateMutation.isPending || testMutation.isPending;

  if (settingsQuery.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          description="Asset storage provider ve CDN public URL ayarlarını yönetin."
          eyebrow="Settings"
          title="Storage & CDN"
        />
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (settingsQuery.isError || !settingsQuery.data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          actions={
            <Button onClick={() => settingsQuery.refetch()} size="sm" type="button" variant="outline">
              <RefreshCcw className="mr-2 h-4 w-4" />
              Tekrar dene
            </Button>
          }
          description="Asset storage provider ve CDN public URL ayarlarını yönetin."
          eyebrow="Settings"
          title="Storage & CDN"
        />
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Storage ayarları okunamadı</CardTitle>
            <CardDescription>
              {(settingsQuery.error as Error | undefined)?.message ?? 'Ayarlar şu anda alınamıyor.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        description="Asset storage provider ve CDN public URL ayarlarını yönetin."
        eyebrow="Settings"
        title="Storage & CDN"
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>Aktif provider</CardTitle>
                <CardDescription>Yeni Cloud Upload istekleri bu ayarlara göre çalışır.</CardDescription>
              </div>
              <Badge variant={settingsQuery.data.activeProvider === 'gcs' ? 'default' : 'secondary'}>
                {settingsQuery.data.activeProvider === 'gcs' ? 'Google Cloud Storage' : 'Local disk'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <HardDrive className="h-4 w-4" />
                Local public base URL
              </div>
              <p className="mt-2 break-all text-sm text-muted-foreground">
                {settingsQuery.data.localPublicAssetBaseUrl}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Cloud className="h-4 w-4" />
                Production önerisi
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Yüksek mobil trafik için Server Upload yerine Cloud Upload kullanın.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Google Cloud Storage</CardTitle>
            <CardDescription>
              Credential bilgisi admin panelde saklanmaz; API runtime&apos;ı Application Default Credentials kullanır.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="gcs-project-id">Project ID</Label>
                <Input
                  id="gcs-project-id"
                  onChange={(event) => updateField('projectId', event.target.value)}
                  placeholder="open-story-prod"
                  value={values.projectId}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="gcs-bucket">Bucket</Label>
                <Input
                  id="gcs-bucket"
                  onChange={(event) => updateField('bucketName', event.target.value)}
                  placeholder="open-story-assets-prod"
                  value={values.bucketName}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="gcs-public-url">CDN public base URL</Label>
              <Input
                id="gcs-public-url"
                onChange={(event) => updateField('publicAssetBaseUrl', event.target.value)}
                placeholder="https://assets.example.com"
                type="url"
                value={values.publicAssetBaseUrl}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="gcs-prefix">Object prefix</Label>
                <Input
                  id="gcs-prefix"
                  onChange={(event) => updateField('objectPrefix', event.target.value)}
                  placeholder="assets"
                  value={values.objectPrefix}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="gcs-cache-control">Cache-Control</Label>
                <Input
                  id="gcs-cache-control"
                  onChange={(event) => updateField('cacheControl', event.target.value)}
                  value={values.cacheControl}
                />
              </div>
            </div>

            {notice ? (
              <div
                className={`rounded-lg border px-4 py-3 text-sm leading-6 ${
                  notice.tone === 'success'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
                    : 'border-destructive/30 bg-destructive/10 text-destructive'
                }`}
              >
                {notice.message}
              </div>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                disabled={isBusy}
                onClick={() => testMutation.mutate(payload)}
                type="button"
                variant="outline"
              >
                <TestTube2 className="mr-2 h-4 w-4" />
                Test et
              </Button>
              <Button disabled={isBusy} onClick={() => updateMutation.mutate(payload)} type="button">
                <Save className="mr-2 h-4 w-4" />
                Kaydet
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
