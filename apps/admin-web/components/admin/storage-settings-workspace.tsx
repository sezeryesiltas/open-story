'use client';

import type {
  AssetStorageProviderDto,
  AssetStorageSettingsDto,
  TestAssetStorageConnectionResponseDto,
  UpdateAssetStorageSettingsDto,
} from '@open-story/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@open-story/ui/components/badge';
import { Button } from '@open-story/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@open-story/ui/components/card';
import { Input } from '@open-story/ui/components/input';
import { Label } from '@open-story/ui/components/label';
import { Skeleton } from '@open-story/ui/components/skeleton';
import { Cloud, HardDrive, KeyRound, RefreshCcw, Save, TestTube2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/admin/page-header';
import { ApiRequestError, apiRequest } from '@/lib/api';

type Notice = {
  provider: 'gcs' | 'supabase_s3';
  tone: 'success' | 'error';
  message: string;
};

type GcsFormValues = {
  projectId: string;
  bucketName: string;
  objectPrefix: string;
  publicAssetBaseUrl: string;
  cacheControl: string;
};

type SupabaseS3FormValues = {
  endpoint: string;
  region: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
  objectPrefix: string;
  publicAssetBaseUrl: string;
  cacheControl: string;
};

type FormValues = {
  gcs: GcsFormValues;
  supabaseS3: SupabaseS3FormValues;
};

const DEFAULT_CACHE_CONTROL = 'public, max-age=31536000, immutable';

const DEFAULT_FORM_VALUES: FormValues = {
  gcs: {
    projectId: '',
    bucketName: '',
    objectPrefix: 'assets',
    publicAssetBaseUrl: '',
    cacheControl: DEFAULT_CACHE_CONTROL,
  },
  supabaseS3: {
    endpoint: '',
    region: 'project_region',
    bucketName: '',
    accessKeyId: '',
    secretAccessKey: '',
    objectPrefix: 'assets',
    publicAssetBaseUrl: '',
    cacheControl: DEFAULT_CACHE_CONTROL,
  },
};

function toFormValues(settings: AssetStorageSettingsDto): FormValues {
  return {
    gcs: {
      projectId: settings.gcs.projectId ?? '',
      bucketName: settings.gcs.bucketName ?? '',
      objectPrefix: settings.gcs.objectPrefix,
      publicAssetBaseUrl: settings.gcs.publicAssetBaseUrl ?? '',
      cacheControl: settings.gcs.cacheControl,
    },
    supabaseS3: {
      endpoint: settings.supabaseS3.endpoint ?? '',
      region: settings.supabaseS3.region,
      bucketName: settings.supabaseS3.bucketName ?? '',
      accessKeyId: settings.supabaseS3.accessKeyId ?? '',
      secretAccessKey: '',
      objectPrefix: settings.supabaseS3.objectPrefix,
      publicAssetBaseUrl: settings.supabaseS3.publicAssetBaseUrl ?? '',
      cacheControl: settings.supabaseS3.cacheControl,
    },
  };
}

function toGcsPayload(values: GcsFormValues): UpdateAssetStorageSettingsDto {
  return {
    activeProvider: 'gcs',
    gcs: {
      projectId: values.projectId.trim() || null,
      bucketName: values.bucketName.trim() || null,
      objectPrefix: values.objectPrefix.trim() || 'assets',
      publicAssetBaseUrl: values.publicAssetBaseUrl.trim() || null,
      cacheControl: values.cacheControl.trim() || DEFAULT_CACHE_CONTROL,
    },
  };
}

function toSupabaseS3Payload(values: SupabaseS3FormValues): UpdateAssetStorageSettingsDto {
  return {
    activeProvider: 'supabase_s3',
    supabaseS3: {
      endpoint: values.endpoint.trim() || null,
      region: values.region.trim() || 'project_region',
      bucketName: values.bucketName.trim() || null,
      accessKeyId: values.accessKeyId.trim() || null,
      secretAccessKey: values.secretAccessKey,
      objectPrefix: values.objectPrefix.trim() || 'assets',
      publicAssetBaseUrl: values.publicAssetBaseUrl.trim() || null,
      cacheControl: values.cacheControl.trim() || DEFAULT_CACHE_CONTROL,
    },
  };
}

function getStorageProviderLabel(provider: AssetStorageProviderDto): string {
  if (provider === 'gcs') {
    return 'Google Cloud Storage';
  }

  if (provider === 'supabase_s3') {
    return 'Supabase Storage S3';
  }

  return 'Local disk';
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
    mutationFn: ({
      payload,
    }: {
      provider: Notice['provider'];
      payload: UpdateAssetStorageSettingsDto;
    }) =>
      apiRequest<AssetStorageSettingsDto>('/api/settings/storage', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: (settings, variables) => {
      queryClient.setQueryData(['asset-storage-settings'], settings);
      setValues(toFormValues(settings));
      setNotice({
        provider: variables.provider,
        tone: 'success',
        message: 'Storage settings were updated.',
      });
    },
    onError: (error, variables) => {
      setNotice({
        provider: variables.provider,
        tone: 'error',
        message:
          error instanceof ApiRequestError || error instanceof Error
            ? error.message
            : 'Storage settings could not be updated.',
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: ({
      payload,
    }: {
      provider: Notice['provider'];
      payload: UpdateAssetStorageSettingsDto;
    }) =>
      apiRequest<TestAssetStorageConnectionResponseDto>('/api/settings/storage/test', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (result, variables) => {
      setNotice({
        provider: variables.provider,
        tone: result.ok ? 'success' : 'error',
        message: result.message,
      });
    },
    onError: (error, variables) => {
      setNotice({
        provider: variables.provider,
        tone: 'error',
        message:
          error instanceof ApiRequestError || error instanceof Error
            ? error.message
            : 'Storage connection could not be tested.',
      });
    },
  });

  const updateGcsField = (field: keyof GcsFormValues, value: string) => {
    setValues((current) => ({
      ...current,
      gcs: {
        ...current.gcs,
        [field]: value,
      },
    }));
    setNotice(null);
  };

  const updateSupabaseS3Field = (field: keyof SupabaseS3FormValues, value: string) => {
    setValues((current) => ({
      ...current,
      supabaseS3: {
        ...current.supabaseS3,
        [field]: value,
      },
    }));
    setNotice(null);
  };

  const gcsPayload = toGcsPayload(values.gcs);
  const supabaseS3Payload = toSupabaseS3Payload(values.supabaseS3);
  const isBusy = updateMutation.isPending || testMutation.isPending;

  if (settingsQuery.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Storage & CDN" />
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
              Try again
            </Button>
          }
          title="Storage & CDN"
        />
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Storage settings could not be read</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {(settingsQuery.error as Error | undefined)?.message ?? 'Settings cannot be fetched right now.'}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const settings = settingsQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Storage & CDN" />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>Active Provider</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  Runtime uses storage env values first, then the config file, then local storage fallback.
                </p>
              </div>
              <Badge variant={settings.activeProvider === 'local' ? 'secondary' : 'default'}>
                {getStorageProviderLabel(settings.activeProvider)}
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
                {settings.localPublicAssetBaseUrl}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Cloud className="h-4 w-4" />
                Production recommendation
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Google Cloud Storage</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="gcs-project-id">Project ID</Label>
                <Input
                  id="gcs-project-id"
                  onChange={(event) => updateGcsField('projectId', event.target.value)}
                  placeholder="open-story-prod"
                  value={values.gcs.projectId}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="gcs-bucket">Bucket</Label>
                <Input
                  id="gcs-bucket"
                  onChange={(event) => updateGcsField('bucketName', event.target.value)}
                  placeholder="open-story-assets-prod"
                  value={values.gcs.bucketName}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="gcs-public-url">CDN public base URL</Label>
              <Input
                id="gcs-public-url"
                onChange={(event) => updateGcsField('publicAssetBaseUrl', event.target.value)}
                placeholder="https://assets.example.com"
                type="url"
                value={values.gcs.publicAssetBaseUrl}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="gcs-prefix">Object prefix</Label>
                <Input
                  id="gcs-prefix"
                  onChange={(event) => updateGcsField('objectPrefix', event.target.value)}
                  placeholder="assets"
                  value={values.gcs.objectPrefix}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="gcs-cache-control">Cache-Control</Label>
                <Input
                  id="gcs-cache-control"
                  onChange={(event) => updateGcsField('cacheControl', event.target.value)}
                  value={values.gcs.cacheControl}
                />
              </div>
            </div>

            {notice?.provider === 'gcs' ? (
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
                onClick={() => testMutation.mutate({ provider: 'gcs', payload: gcsPayload })}
                type="button"
                variant="outline"
              >
                <TestTube2 className="mr-2 h-4 w-4" />
                Test
              </Button>
              <Button
                disabled={isBusy}
                onClick={() => updateMutation.mutate({ provider: 'gcs', payload: gcsPayload })}
                type="button"
              >
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Supabase Storage S3</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="supabase-s3-endpoint">Endpoint</Label>
              <Input
                id="supabase-s3-endpoint"
                onChange={(event) => updateSupabaseS3Field('endpoint', event.target.value)}
                placeholder="https://project-ref.storage.supabase.co/storage/v1/s3"
                type="url"
                value={values.supabaseS3.endpoint}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="supabase-s3-region">Region</Label>
                <Input
                  id="supabase-s3-region"
                  onChange={(event) => updateSupabaseS3Field('region', event.target.value)}
                  placeholder="project_region"
                  value={values.supabaseS3.region}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="supabase-s3-bucket">Bucket</Label>
                <Input
                  id="supabase-s3-bucket"
                  onChange={(event) => updateSupabaseS3Field('bucketName', event.target.value)}
                  placeholder="open-story-assets"
                  value={values.supabaseS3.bucketName}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="supabase-s3-access-key-id">Access key ID</Label>
                <Input
                  id="supabase-s3-access-key-id"
                  onChange={(event) => updateSupabaseS3Field('accessKeyId', event.target.value)}
                  placeholder="sbp_..."
                  value={values.supabaseS3.accessKeyId}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="supabase-s3-secret-access-key">Secret access key</Label>
                <Input
                  id="supabase-s3-secret-access-key"
                  onChange={(event) => updateSupabaseS3Field('secretAccessKey', event.target.value)}
                  placeholder={
                    settings.supabaseS3.secretAccessKeyConfigured
                      ? 'Existing secret is preserved'
                      : 'Supabase S3 secret access key'
                  }
                  type="password"
                  value={values.supabaseS3.secretAccessKey}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="supabase-s3-public-url">CDN public base URL</Label>
              <Input
                id="supabase-s3-public-url"
                onChange={(event) => updateSupabaseS3Field('publicAssetBaseUrl', event.target.value)}
                placeholder="https://project-ref.supabase.co/storage/v1/object/public/open-story-assets"
                type="url"
                value={values.supabaseS3.publicAssetBaseUrl}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="supabase-s3-prefix">Object prefix</Label>
                <Input
                  id="supabase-s3-prefix"
                  onChange={(event) => updateSupabaseS3Field('objectPrefix', event.target.value)}
                  placeholder="assets"
                  value={values.supabaseS3.objectPrefix}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="supabase-s3-cache-control">Cache-Control</Label>
                <Input
                  id="supabase-s3-cache-control"
                  onChange={(event) => updateSupabaseS3Field('cacheControl', event.target.value)}
                  value={values.supabaseS3.cacheControl}
                />
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <KeyRound className="h-4 w-4" />
                S3 access keys
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Supabase S3 access keys bypass bucket RLS rules; use this setting only inside the API runtime.
              </p>
            </div>

            {notice?.provider === 'supabase_s3' ? (
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
                onClick={() =>
                  testMutation.mutate({
                    provider: 'supabase_s3',
                    payload: supabaseS3Payload,
                  })
                }
                type="button"
                variant="outline"
              >
                <TestTube2 className="mr-2 h-4 w-4" />
                Test
              </Button>
              <Button
                disabled={isBusy}
                onClick={() =>
                  updateMutation.mutate({
                    provider: 'supabase_s3',
                    payload: supabaseS3Payload,
                  })
                }
                type="button"
              >
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
