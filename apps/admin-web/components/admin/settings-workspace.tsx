'use client';

import type {
  DatabaseSettingsDto,
  PostgresSslModeDto,
  TestDatabaseConnectionResponseDto,
  UpdateDatabaseSettingsDto,
} from '@open-story/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@open-story/ui/components/badge';
import { Button } from '@open-story/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@open-story/ui/components/card';
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
import { Skeleton } from '@open-story/ui/components/skeleton';
import { Database, RefreshCcw, Server } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { PageHeader } from '@/components/admin/page-header';
import { ApiRequestError, apiRequest } from '@/lib/api';

type Notice =
  | {
      tone: 'success';
      message: string;
    }
  | {
      tone: 'error';
      message: string;
    };

const POSTGRES_DEFAULT_PORT = '5432';
const DEFAULT_POSTGRES_SSL_MODE: PostgresSslModeDto = 'require';

const formSchema = z
  .object({
    postgresHost: z.string().trim().max(255, 'Postgres host en fazla 255 karakter olabilir.').optional(),
    postgresPort: z.string().trim().max(5, 'Postgres port en fazla 5 karakter olabilir.').optional(),
    postgresDatabase: z.string().trim().max(128, 'Postgres database adı en fazla 128 karakter olabilir.').optional(),
    postgresUsername: z.string().trim().max(128, 'Postgres kullanıcı adı en fazla 128 karakter olabilir.').optional(),
    postgresPassword: z.string().max(1024, 'Postgres password en fazla 1024 karakter olabilir.').optional(),
    postgresSslMode: z.enum(['disable', 'require']).optional(),
  })
  .superRefine((values, context) => {
    if (!values.postgresHost?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Postgres host boş bırakılamaz.',
        path: ['postgresHost'],
      });
    }

    if (!values.postgresDatabase?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Postgres database adı boş bırakılamaz.',
        path: ['postgresDatabase'],
      });
    }

    if (!values.postgresUsername?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Postgres kullanıcı adı boş bırakılamaz.',
        path: ['postgresUsername'],
      });
    }

    const port = Number(values.postgresPort?.trim() || POSTGRES_DEFAULT_PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Postgres port 1 ile 65535 arasında bir tam sayı olmalıdır.',
        path: ['postgresPort'],
      });
    }
  });

type SettingsFormValues = z.infer<typeof formSchema>;
type DatabaseAction = 'postgres-test' | 'postgres-save';

function LoadingCards() {
  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-card/80">
        <CardHeader className="space-y-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <Skeleton className="h-5 w-44" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-80 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

function toPostgresPayload(values: SettingsFormValues): UpdateDatabaseSettingsDto {
  return {
    postgres: {
      host: values.postgresHost?.trim() ?? '',
      port: values.postgresPort?.trim() || POSTGRES_DEFAULT_PORT,
      database: values.postgresDatabase?.trim() ?? '',
      username: values.postgresUsername?.trim() ?? '',
      password: values.postgresPassword ?? '',
      sslMode: (values.postgresSslMode ?? DEFAULT_POSTGRES_SSL_MODE) as PostgresSslModeDto,
    },
  };
}

export function SettingsWorkspace() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [activeAction, setActiveAction] = useState<DatabaseAction | null>(null);

  const settingsQuery = useQuery({
    queryKey: ['database-settings'],
    queryFn: () => apiRequest<DatabaseSettingsDto>('/api/settings/database'),
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      postgresHost: '',
      postgresPort: POSTGRES_DEFAULT_PORT,
      postgresDatabase: '',
      postgresUsername: '',
      postgresPassword: '',
      postgresSslMode: DEFAULT_POSTGRES_SSL_MODE,
    },
  });

  const postgresSslMode = (watch('postgresSslMode') ?? DEFAULT_POSTGRES_SSL_MODE) as PostgresSslModeDto;

  useEffect(() => {
    if (!settingsQuery.data) {
      return;
    }

    reset({
      postgresHost: settingsQuery.data.postgresDatabase?.host ?? '',
      postgresPort: String(settingsQuery.data.postgresDatabase?.port ?? POSTGRES_DEFAULT_PORT),
      postgresDatabase: settingsQuery.data.postgresDatabase?.database ?? '',
      postgresUsername: settingsQuery.data.postgresDatabase?.username ?? '',
      postgresPassword: '',
      postgresSslMode: settingsQuery.data.postgresDatabase?.sslMode ?? DEFAULT_POSTGRES_SSL_MODE,
    });
  }, [reset, settingsQuery.data]);

  const updateMutation = useMutation({
    mutationFn: ({ payload }: { payload: UpdateDatabaseSettingsDto }) =>
      apiRequest<DatabaseSettingsDto>('/api/settings/database', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['database-settings'], data);
      reset({
        postgresHost: data.postgresDatabase?.host ?? '',
        postgresPort: String(data.postgresDatabase?.port ?? POSTGRES_DEFAULT_PORT),
        postgresDatabase: data.postgresDatabase?.database ?? '',
        postgresUsername: data.postgresDatabase?.username ?? '',
        postgresPassword: '',
        postgresSslMode: data.postgresDatabase?.sslMode ?? DEFAULT_POSTGRES_SSL_MODE,
      });
      setNotice({
        tone: 'success',
        message: 'Postgres relational veritabanı ayarları kaydedildi.',
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
    onSettled: () => {
      setActiveAction(null);
    },
  });

  const connectionTestMutation = useMutation({
    mutationFn: ({ payload }: { payload: UpdateDatabaseSettingsDto }) =>
      apiRequest<TestDatabaseConnectionResponseDto>('/api/settings/database/test', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      setNotice({
        tone: data.ok ? 'success' : 'error',
        message: data.resolvedDatabaseUrl
          ? `${data.message} Hedef: ${data.resolvedDatabaseUrl}`
          : data.message,
      });
    },
    onError: (error) => {
      setNotice({
        tone: 'error',
        message:
          error instanceof ApiRequestError || error instanceof Error
            ? error.message
            : 'Database bağlantısı test edilemedi.',
      });
    },
    onSettled: () => {
      setActiveAction(null);
    },
  });

  const isBusy = settingsQuery.isLoading || updateMutation.isPending || connectionTestMutation.isPending;
  const settings = settingsQuery.data;

  const savePostgres = handleSubmit((values) => {
    setNotice(null);
    setActiveAction('postgres-save');
    updateMutation.mutate({ payload: toPostgresPayload(values) });
  });

  const testPostgres = handleSubmit((values) => {
    setNotice(null);
    setActiveAction('postgres-test');
    connectionTestMutation.mutate({ payload: toPostgresPayload(values) });
  });

  const isActionPending = (action: DatabaseAction) =>
    activeAction === action && (updateMutation.isPending || connectionTestMutation.isPending);

  if (settingsQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Veritabanı ayarları" />
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
          title="Veritabanı ayarları"
        />

        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Veritabanı ayarları okunamadı</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {(settingsQuery.error as Error | undefined)?.message ?? 'Ayarlar şu anda alınamıyor.'}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Veritabanı ayarları" />

      <Card className="border-border/60 bg-card/80">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle>Aktif veritabanı</CardTitle>
              <p className="text-sm text-muted-foreground">
                Runtime önce `OPEN_STORY_POSTGRES_*` env değerlerine, sonra config dosyasına bakar. Production
                ortamında Postgres zorunludur; local fallback yalnızca non-production/test kullanım içindir.
              </p>
            </div>
            <Badge className="w-fit" variant={settings.activeProvider === 'postgres' ? 'default' : 'secondary'}>
              {settings.activeProvider === 'postgres' ? 'Postgres relational aktif' : 'Postgres yapılandırılmamış'}
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

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Database className="h-4 w-4" />
                Aktif database
              </div>
              <p className="mt-3 break-all text-sm leading-6 text-muted-foreground">
                {settings.activeDatabaseUrl}
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/30 p-5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Server className="h-4 w-4" />
                Runtime modeli
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Normalize Postgres tabloları, revision ve composition ilişkileri DB constraint&apos;leri ile korunur.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle>Postgres bağlantı bilgileri</CardTitle>
        </CardHeader>

        <CardContent>
          <form className="grid gap-5 md:grid-cols-2" onSubmit={(event) => event.preventDefault()}>
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="postgresHost">Host</Label>
              <Input id="postgresHost" placeholder="db.project-ref.supabase.co" {...register('postgresHost')} />
              {errors.postgresHost ? <p className="text-sm text-destructive">{errors.postgresHost.message}</p> : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="postgresPort">Port</Label>
              <Input id="postgresPort" inputMode="numeric" placeholder={POSTGRES_DEFAULT_PORT} {...register('postgresPort')} />
              {errors.postgresPort ? <p className="text-sm text-destructive">{errors.postgresPort.message}</p> : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="postgresDatabase">Database</Label>
              <Input id="postgresDatabase" placeholder="postgres" {...register('postgresDatabase')} />
              {errors.postgresDatabase ? (
                <p className="text-sm text-destructive">{errors.postgresDatabase.message}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="postgresUsername">Kullanıcı adı</Label>
              <Input id="postgresUsername" autoComplete="username" placeholder="postgres" {...register('postgresUsername')} />
              {errors.postgresUsername ? (
                <p className="text-sm text-destructive">{errors.postgresUsername.message}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="postgresPassword">Password</Label>
              <Input
                id="postgresPassword"
                autoComplete="current-password"
                placeholder={settings.postgresDatabase?.passwordConfigured ? 'Mevcut password korunur' : '••••••••'}
                type="password"
                {...register('postgresPassword')}
              />
              {errors.postgresPassword ? (
                <p className="text-sm text-destructive">{errors.postgresPassword.message}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="postgresSslMode">SSL mode</Label>
              <Select
                onValueChange={(value) =>
                  setValue('postgresSslMode', value as PostgresSslModeDto, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                value={postgresSslMode}
              >
                <SelectTrigger id="postgresSslMode">
                  <SelectValue placeholder="SSL mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="require">require</SelectItem>
                    <SelectItem value="disable">disable</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              {errors.postgresSslMode ? (
                <p className="text-sm text-destructive">{errors.postgresSslMode.message}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row md:col-span-2">
              <Button disabled={isBusy} onClick={testPostgres} type="button" variant="outline">
                {isActionPending('postgres-test') ? 'Test ediliyor...' : 'Postgres connection test'}
              </Button>
              <Button disabled={isBusy} onClick={savePostgres} type="button">
                {isActionPending('postgres-save') ? 'Kaydediliyor...' : 'Postgres ayarını kaydet'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
