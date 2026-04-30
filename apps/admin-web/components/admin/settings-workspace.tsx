'use client';

import type {
  DatabaseSettingsDto,
  TestDatabaseConnectionResponseDto,
  UpdateDatabaseSettingsDto,
} from '@open-story/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@open-story/ui/components/badge';
import { Button } from '@open-story/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@open-story/ui/components/card';
import { Input } from '@open-story/ui/components/input';
import { Label } from '@open-story/ui/components/label';
import { Skeleton } from '@open-story/ui/components/skeleton';
import { Database, HardDriveDownload, RefreshCcw, Server } from 'lucide-react';
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

const MYSQL_DEFAULT_PORT = '3306';

const formSchema = z.object({
  externalDatabaseUrl: z
    .string()
    .trim()
    .max(1024, 'Database URL/path en fazla 1024 karakter olabilir.')
    .optional(),
  mysqlHost: z.string().trim().max(255, 'MySQL host en fazla 255 karakter olabilir.').optional(),
  mysqlPort: z.string().trim().max(5, 'MySQL port en fazla 5 karakter olabilir.').optional(),
  mysqlDatabase: z.string().trim().max(128, 'MySQL database adı en fazla 128 karakter olabilir.').optional(),
  mysqlUsername: z.string().trim().max(128, 'MySQL kullanıcı adı en fazla 128 karakter olabilir.').optional(),
  mysqlPassword: z.string().max(1024, 'MySQL password en fazla 1024 karakter olabilir.').optional(),
});

const sqliteActionSchema = z.object({
  externalDatabaseUrl: z
    .string()
    .trim()
    .min(1, 'SQLite path boş bırakılamaz.')
    .max(1024, 'Database URL/path en fazla 1024 karakter olabilir.'),
});

const mysqlActionSchema = z
  .object({
    mysqlHost: z.string().trim().max(255, 'MySQL host en fazla 255 karakter olabilir.').optional(),
    mysqlPort: z.string().trim().max(5, 'MySQL port en fazla 5 karakter olabilir.').optional(),
    mysqlDatabase: z.string().trim().max(128, 'MySQL database adı en fazla 128 karakter olabilir.').optional(),
    mysqlUsername: z.string().trim().max(128, 'MySQL kullanıcı adı en fazla 128 karakter olabilir.').optional(),
    mysqlPassword: z.string().max(1024, 'MySQL password en fazla 1024 karakter olabilir.').optional(),
  })
  .superRefine((values, context) => {
    if (!values.mysqlHost?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MySQL host boş bırakılamaz.',
        path: ['mysqlHost'],
      });
    }

    if (!values.mysqlDatabase?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MySQL database adı boş bırakılamaz.',
        path: ['mysqlDatabase'],
      });
    }

    if (!values.mysqlUsername?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MySQL kullanıcı adı boş bırakılamaz.',
        path: ['mysqlUsername'],
      });
    }

    const port = Number(values.mysqlPort?.trim() || MYSQL_DEFAULT_PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MySQL port 1 ile 65535 arasında bir tam sayı olmalıdır.',
        path: ['mysqlPort'],
      });
    }
  });

type SettingsFormValues = z.infer<typeof formSchema>;

type DatabaseAction =
  | 'sqlite-test'
  | 'sqlite-save'
  | 'mysql-test'
  | 'mysql-save'
  | 'local-save';

const formFieldNames = new Set<keyof SettingsFormValues>([
  'externalDatabaseUrl',
  'mysqlHost',
  'mysqlPort',
  'mysqlDatabase',
  'mysqlUsername',
  'mysqlPassword',
]);

function getProviderBadgeLabel(settings: DatabaseSettingsDto): string {
  if (settings.activeProvider === 'mysql') {
    return 'Harici MySQL aktif';
  }

  return settings.isUsingExternalDatabase ? 'Harici SQLite aktif' : 'Yerel SQLite aktif';
}

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
        <CardHeader className="space-y-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export function SettingsWorkspace() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [sqliteNotice, setSqliteNotice] = useState<Notice | null>(null);
  const [mysqlNotice, setMysqlNotice] = useState<Notice | null>(null);
  const [activeAction, setActiveAction] = useState<DatabaseAction | null>(null);

  const settingsQuery = useQuery({
    queryKey: ['database-settings'],
    queryFn: () => apiRequest<DatabaseSettingsDto>('/api/settings/database'),
  });

  const {
    register,
    getValues,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      externalDatabaseUrl: '',
      mysqlHost: '',
      mysqlPort: MYSQL_DEFAULT_PORT,
      mysqlDatabase: '',
      mysqlUsername: '',
      mysqlPassword: '',
    },
  });

  useEffect(() => {
    if (!settingsQuery.data) {
      return;
    }

    reset({
      externalDatabaseUrl: settingsQuery.data.externalDatabaseUrl ?? '',
      mysqlHost: settingsQuery.data.mysqlDatabase?.host ?? '',
      mysqlPort: String(settingsQuery.data.mysqlDatabase?.port ?? MYSQL_DEFAULT_PORT),
      mysqlDatabase: settingsQuery.data.mysqlDatabase?.database ?? '',
      mysqlUsername: settingsQuery.data.mysqlDatabase?.username ?? '',
      mysqlPassword: '',
    });
  }, [reset, settingsQuery.data]);

  const setActionNotice = (action: DatabaseAction, value: Notice | null) => {
    if (action.startsWith('sqlite')) {
      setSqliteNotice(value);
      return;
    }

    if (action.startsWith('mysql')) {
      setMysqlNotice(value);
      return;
    }

    setNotice(value);
  };

  const updateMutation = useMutation({
    mutationFn: ({ payload }: { action: DatabaseAction; payload: UpdateDatabaseSettingsDto }) =>
      apiRequest<DatabaseSettingsDto>('/api/settings/database', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['database-settings'], data);
      reset({
        externalDatabaseUrl: data.externalDatabaseUrl ?? '',
        mysqlHost: data.mysqlDatabase?.host ?? '',
        mysqlPort: String(data.mysqlDatabase?.port ?? MYSQL_DEFAULT_PORT),
        mysqlDatabase: data.mysqlDatabase?.database ?? '',
        mysqlUsername: data.mysqlDatabase?.username ?? '',
        mysqlPassword: '',
      });
      setActionNotice(variables.action, {
        tone: 'success',
        message:
          variables.action === 'mysql-save'
            ? 'Harici MySQL veritabanı etkinleştirildi. Mevcut veriler yeni hedefe taşındı.'
            : variables.action === 'sqlite-save'
              ? 'Harici SQLite veritabanı etkinleştirildi. Mevcut veriler yeni konuma taşındı.'
              : 'Varsayılan veritabanına geri dönüldü.',
      });
      if (variables.action === 'mysql-save') {
        setSqliteNotice(null);
        setNotice(null);
      } else if (variables.action === 'sqlite-save') {
        setMysqlNotice(null);
        setNotice(null);
      } else {
        setSqliteNotice(null);
        setMysqlNotice(null);
      }
    },
    onError: (error, variables) => {
      setActionNotice(variables.action, {
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
    mutationFn: ({ payload }: { action: DatabaseAction; payload: UpdateDatabaseSettingsDto }) =>
      apiRequest<TestDatabaseConnectionResponseDto>('/api/settings/database/test', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (data, variables) => {
      setActionNotice(variables.action, {
        tone: data.ok ? 'success' : 'error',
        message: data.resolvedDatabaseUrl
          ? `${data.message} Hedef: ${data.resolvedDatabaseUrl}`
          : data.message,
      });
    },
    onError: (error, variables) => {
      setActionNotice(variables.action, {
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

  const validateAction = (
    action: 'sqlite' | 'mysql',
  ): SettingsFormValues | null => {
    const values = getValues();
    const fields: Array<keyof SettingsFormValues> =
      action === 'sqlite'
        ? ['externalDatabaseUrl']
        : ['mysqlHost', 'mysqlPort', 'mysqlDatabase', 'mysqlUsername', 'mysqlPassword'];
    const result = action === 'sqlite'
      ? sqliteActionSchema.safeParse(values)
      : mysqlActionSchema.safeParse(values);

    clearErrors(fields);

    if (result.success) {
      return values;
    }

    for (const issue of result.error.issues) {
      const [field] = issue.path;
      if (typeof field === 'string' && formFieldNames.has(field as keyof SettingsFormValues)) {
        setError(field as keyof SettingsFormValues, {
          type: 'manual',
          message: issue.message,
        });
      }
    }

    return null;
  };

  const toSqlitePayload = (values: SettingsFormValues): UpdateDatabaseSettingsDto => ({
    externalDatabaseUrl: values.externalDatabaseUrl?.trim() ?? null,
    mysql: null,
  });

  const toMysqlPayload = (values: SettingsFormValues): UpdateDatabaseSettingsDto => ({
    externalDatabaseUrl: null,
    mysql: {
      host: values.mysqlHost?.trim() ?? '',
      port: values.mysqlPort?.trim() || MYSQL_DEFAULT_PORT,
      database: values.mysqlDatabase?.trim() ?? '',
      username: values.mysqlUsername?.trim() ?? '',
      password: values.mysqlPassword ?? '',
    },
  });

  const saveSqlite = () => {
    const values = validateAction('sqlite');
    if (!values) {
      return;
    }

    const action: DatabaseAction = 'sqlite-save';
    setNotice(null);
    setSqliteNotice(null);
    setActiveAction(action);
    updateMutation.mutate({ action, payload: toSqlitePayload(values) });
  };

  const testSqlite = () => {
    const values = validateAction('sqlite');
    if (!values) {
      return;
    }

    const action: DatabaseAction = 'sqlite-test';
    setNotice(null);
    setSqliteNotice(null);
    setActiveAction(action);
    connectionTestMutation.mutate({ action, payload: toSqlitePayload(values) });
  };

  const saveMysql = () => {
    const values = validateAction('mysql');
    if (!values) {
      return;
    }

    const action: DatabaseAction = 'mysql-save';
    setNotice(null);
    setMysqlNotice(null);
    setActiveAction(action);
    updateMutation.mutate({ action, payload: toMysqlPayload(values) });
  };

  const testMysql = () => {
    const values = validateAction('mysql');
    if (!values) {
      return;
    }

    const action: DatabaseAction = 'mysql-test';
    setNotice(null);
    setMysqlNotice(null);
    setActiveAction(action);
    connectionTestMutation.mutate({ action, payload: toMysqlPayload(values) });
  };

  const switchBackToLocal = () => {
    const action: DatabaseAction = 'local-save';
    setNotice(null);
    setSqliteNotice(null);
    setMysqlNotice(null);
    setActiveAction(action);
    updateMutation.mutate({
      action,
      payload: {
        externalDatabaseUrl: null,
        mysql: null,
      },
    });
  };

  const isActionPending = (action: DatabaseAction) =>
    activeAction === action && (updateMutation.isPending || connectionTestMutation.isPending);

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

      <div className="space-y-6">
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
                {getProviderBadgeLabel(settings)}
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
              SQLite path ya da MySQL bağlantı bilgisi tanımlayabilirsiniz.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <form className="grid gap-5 lg:grid-cols-2" onSubmit={(event) => event.preventDefault()}>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                <div className="mb-4 space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <HardDriveDownload className="h-4 w-4" />
                    SQLite bağlantı bilgileri
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Harici SQLite dosya URL ya da absolute path tanımlayın.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="externalDatabaseUrl">SQLite Harici DB URL / path</Label>
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

                {sqliteNotice ? (
                  <div
                    className={`mt-4 rounded-lg border px-4 py-3 text-sm leading-6 ${
                      sqliteNotice.tone === 'success'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
                        : 'border-destructive/30 bg-destructive/10 text-destructive'
                    }`}
                  >
                    {sqliteNotice.message}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <Button disabled={isBusy} onClick={testSqlite} type="button" variant="outline">
                    {isActionPending('sqlite-test') ? 'Test ediliyor...' : 'SQLite connection test'}
                  </Button>
                  <Button disabled={isBusy} onClick={saveSqlite} type="button">
                    {isActionPending('sqlite-save') ? 'Kaydediliyor...' : 'SQLite ayarını kaydet'}
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                <div className="mb-4 space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Server className="h-4 w-4" />
                    MySQL bağlantı bilgileri
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Harici MySQL hedefini aynı ayar seviyesinde tanımlayın.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <Label htmlFor="mysqlHost">Host</Label>
                    <Input id="mysqlHost" placeholder="mysql.example.internal" {...register('mysqlHost')} />
                    {errors.mysqlHost ? (
                      <p className="text-sm text-destructive">{errors.mysqlHost.message}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="mysqlPort">Port</Label>
                    <Input id="mysqlPort" inputMode="numeric" placeholder={MYSQL_DEFAULT_PORT} {...register('mysqlPort')} />
                    {errors.mysqlPort ? (
                      <p className="text-sm text-destructive">{errors.mysqlPort.message}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="mysqlDatabase">Database</Label>
                    <Input id="mysqlDatabase" placeholder="open_story" {...register('mysqlDatabase')} />
                    {errors.mysqlDatabase ? (
                      <p className="text-sm text-destructive">{errors.mysqlDatabase.message}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="mysqlUsername">Kullanıcı adı</Label>
                    <Input id="mysqlUsername" autoComplete="username" placeholder="open_story_user" {...register('mysqlUsername')} />
                    {errors.mysqlUsername ? (
                      <p className="text-sm text-destructive">{errors.mysqlUsername.message}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="mysqlPassword">Password</Label>
                    <Input
                      id="mysqlPassword"
                      autoComplete="current-password"
                      placeholder={settings.mysqlDatabase?.passwordConfigured ? 'Aynı hedefte mevcut password korunur' : '••••••••'}
                      type="password"
                      {...register('mysqlPassword')}
                    />
                    {errors.mysqlPassword ? (
                      <p className="text-sm text-destructive">{errors.mysqlPassword.message}</p>
                    ) : null}
                  </div>
                </div>
                <p className="mt-4 text-xs leading-5 text-muted-foreground">
                  MySQL alanlarından biri doluysa kaydetme akışı MySQL hedefini aktif eder; password boş bırakılırsa
                  aynı host, port, database ve kullanıcı adı için mevcut MySQL password korunur.
                </p>

                {mysqlNotice ? (
                  <div
                    className={`mt-4 rounded-lg border px-4 py-3 text-sm leading-6 ${
                      mysqlNotice.tone === 'success'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
                        : 'border-destructive/30 bg-destructive/10 text-destructive'
                    }`}
                  >
                    {mysqlNotice.message}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <Button disabled={isBusy} onClick={testMysql} type="button" variant="outline">
                    {isActionPending('mysql-test') ? 'Test ediliyor...' : 'MySQL connection test'}
                  </Button>
                  <Button disabled={isBusy} onClick={saveMysql} type="button">
                    {isActionPending('mysql-save') ? 'Kaydediliyor...' : 'MySQL ayarını kaydet'}
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-muted/30 p-4 text-sm leading-6 text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:col-span-2">
                <p>
                  SQLite ve MySQL alanlarını boş bırakırsanız varsayılan veritabanı kullanılır.
                </p>
                <Button
                  className="sm:shrink-0"
                  disabled={isBusy || !settings.isUsingExternalDatabase}
                  onClick={switchBackToLocal}
                  type="button"
                  variant="outline"
                >
                  {isActionPending('local-save') ? 'Dönülüyor...' : 'Yerel veritabanına dön'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
