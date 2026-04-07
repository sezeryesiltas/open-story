'use client';

import type { DatabaseSettingsDto, UpdateDatabaseSettingsDto } from '@open-story/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@open-story/ui/components/badge';
import { Button } from '@open-story/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@open-story/ui/components/card';
import { Input } from '@open-story/ui/components/input';
import { Label } from '@open-story/ui/components/label';
import { Skeleton } from '@open-story/ui/components/skeleton';
import { Database, HardDriveDownload, RefreshCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { PageHeader } from '@/components/admin/page-header';
import { ApiRequestError, apiRequest } from '@/lib/api';
import { formatDatabaseSettingsDate } from '@/lib/database-settings-presentation';

type Notice =
  | {
      tone: 'success';
      message: string;
    }
  | {
      tone: 'error';
      message: string;
    };

const formSchema = z.object({
  externalDatabaseUrl: z
    .string()
    .trim()
    .max(1024, 'Database URL/path en fazla 1024 karakter olabilir.')
    .optional(),
});

type SettingsFormValues = z.infer<typeof formSchema>;

function LoadingCards() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
      <Card className="border-border/60 bg-card/80">
        <CardHeader className="space-y-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80">
        <CardHeader className="space-y-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export function SettingsWorkspace() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<Notice | null>(null);

  const settingsQuery = useQuery({
    queryKey: ['database-settings'],
    queryFn: () => apiRequest<DatabaseSettingsDto>('/api/settings/database'),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      externalDatabaseUrl: '',
    },
  });

  useEffect(() => {
    if (!settingsQuery.data) {
      return;
    }

    reset({
      externalDatabaseUrl: settingsQuery.data.externalDatabaseUrl ?? '',
    });
  }, [reset, settingsQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateDatabaseSettingsDto) =>
      apiRequest<DatabaseSettingsDto>('/api/settings/database', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['database-settings'], data);
      reset({
        externalDatabaseUrl: data.externalDatabaseUrl ?? '',
      });
      setNotice({
        tone: 'success',
        message: data.isUsingExternalDatabase
          ? 'Harici veritabanı etkinleştirildi. Mevcut veriler yeni konuma taşındı.'
          : 'Varsayılan veritabanına geri dönüldü.',
      });
    },
    onError: (error) => {
      setNotice({
        tone: 'error',
        message:
          error instanceof ApiRequestError || error instanceof Error
            ? error.message
            : 'Database ayarı güncellenemedi.',
      });
    },
  });

  const isBusy = settingsQuery.isLoading || updateMutation.isPending;
  const settings = settingsQuery.data;

  const submitForm = handleSubmit((values) => {
    setNotice(null);
    updateMutation.mutate({
      externalDatabaseUrl: values.externalDatabaseUrl?.trim() ? values.externalDatabaseUrl.trim() : null,
    });
  });

  const switchBackToLocal = () => {
    setNotice(null);
    updateMutation.mutate({
      externalDatabaseUrl: null,
    });
  };

  if (settingsQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          description="Veri bağlantısı ayarlarını buradan yönetebilirsiniz."
          eyebrow="Settings"
          title="Veritabanı ayarları"
        />
        <LoadingCards />
      </div>
    );
  }

  if (settingsQuery.isError || !settings) {
    return (
      <div className="space-y-6">
        <PageHeader
          actions={
            <Button className="gap-2" onClick={() => settingsQuery.refetch()} variant="outline">
              <RefreshCcw className="h-4 w-4" />
              Tekrar dene
            </Button>
          }
          description="Veri bağlantısı ayarlarını buradan yönetebilirsiniz."
          eyebrow="Settings"
          title="Veritabanı ayarları"
        />

        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Veritabanı ayarları okunamadı</CardTitle>
            <CardDescription>
              {(settingsQuery.error as Error | undefined)?.message ??
                'Ayarlar şu anda alınamıyor.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Veri bağlantısı ayarlarını buradan yönetebilirsiniz."
        eyebrow="Settings"
        title="Veritabanı ayarları"
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <Card className="border-border/60 bg-card/80">
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <CardTitle>Aktif veritabanı</CardTitle>
                <CardDescription>
                  Şu anda kullanılan veritabanını görüntüleyin.
                </CardDescription>
              </div>
              <Badge className="w-fit" variant={settings.isUsingExternalDatabase ? 'default' : 'secondary'}>
                {settings.isUsingExternalDatabase ? 'Harici veritabanı aktif' : 'Yerel veritabanı aktif'}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
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

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-muted/30 p-5">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Database className="h-4 w-4" />
                  Varsayılan veritabanı
                </div>
                <p className="mt-3 break-all text-sm leading-6 text-muted-foreground">
                  {settings.defaultSqliteUrl}
                </p>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/30 p-5">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <HardDriveDownload className="h-4 w-4" />
                  Aktif database
                </div>
                <p className="mt-3 break-all text-sm leading-6 text-muted-foreground">
                  {settings.activeDatabaseUrl}
                </p>
                <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Son kopyalama: {formatDatabaseSettingsDate(settings.migratedAt)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Harici veritabanı</CardTitle>
            <CardDescription>
              İsterseniz farklı bir veritabanı konumu tanımlayabilirsiniz.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <form className="space-y-5" onSubmit={submitForm}>
              <div className="space-y-2">
                <Label htmlFor="externalDatabaseUrl">Harici DB URL / path</Label>
                <Input
                  id="externalDatabaseUrl"
                  placeholder="file:///Volumes/shared/open-story.sqlite"
                  {...register('externalDatabaseUrl')}
                />
                {errors.externalDatabaseUrl ? (
                  <p className="text-sm text-destructive">{errors.externalDatabaseUrl.message}</p>
                ) : (
                  <p className="text-xs leading-5 text-muted-foreground">
                    `file:///absolute/path/open-story.sqlite`, `sqlite:///absolute/path/open-story.sqlite`
                    veya düz absolute path kullanabilirsiniz.
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
                Alanı boş bırakırsanız varsayılan veritabanı kullanılır.
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button className="sm:flex-1" disabled={isBusy} type="submit">
                  {updateMutation.isPending ? 'Kaydediliyor...' : 'Database ayarını kaydet'}
                </Button>
                <Button
                  disabled={isBusy || !settings.isUsingExternalDatabase}
                  onClick={switchBackToLocal}
                  type="button"
                  variant="outline"
                >
                  Yerel veritabanına dön
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
