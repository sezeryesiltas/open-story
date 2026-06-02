'use client';

import type {
  DatabaseSettingsDto,
  MysqlIpTypeDto,
  MysqlSslModeDto,
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
import { useCallback, useEffect, useState } from 'react';
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

type DatabaseAction = 'mysql-test' | 'mysql-save' | 'postgres-test' | 'postgres-save';

const MYSQL_DEFAULT_PORT = '3306';
const POSTGRES_DEFAULT_PORT = '5432';
const DEFAULT_MYSQL_SSL_MODE: MysqlSslModeDto = 'disable';
const DEFAULT_MYSQL_IP_TYPE: MysqlIpTypeDto = 'PUBLIC';
const DEFAULT_POSTGRES_SSL_MODE: PostgresSslModeDto = 'require';

const mysqlFormSchema = z
  .object({
    host: z.string().trim().max(255, 'MySQL host can be at most 255 characters.').optional(),
    port: z.string().trim().max(5, 'MySQL port can be at most 5 characters.').optional(),
    socketPath: z.string().trim().max(1024, 'MySQL socket path can be at most 1024 characters.').optional(),
    instanceConnectionName: z.string().trim().max(255, 'MySQL instance connection name can be at most 255 characters.').optional(),
    ipType: z.enum(['PUBLIC', 'PRIVATE', 'PSC']).optional(),
    database: z.string().trim().max(128, 'MySQL database name can be at most 128 characters.').optional(),
    username: z.string().trim().max(128, 'MySQL username can be at most 128 characters.').optional(),
    password: z.string().max(1024, 'MySQL password can be at most 1024 characters.').optional(),
    sslMode: z.enum(['disable', 'require']).optional(),
  })
  .superRefine((values, context) => {
    if (!values.host?.trim() && !values.socketPath?.trim() && !values.instanceConnectionName?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MySQL host, socket path, or instance connection name is required.',
        path: ['host'],
      });
    }

    if (!values.database?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MySQL database name cannot be empty.',
        path: ['database'],
      });
    }

    if (!values.username?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MySQL username cannot be empty.',
        path: ['username'],
      });
    }

    const port = Number(values.port?.trim() || MYSQL_DEFAULT_PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MySQL port must be an integer between 1 and 65535.',
        path: ['port'],
      });
    }
  });

const postgresFormSchema = z
  .object({
    host: z.string().trim().max(255, 'Postgres host can be at most 255 characters.').optional(),
    port: z.string().trim().max(5, 'Postgres port can be at most 5 characters.').optional(),
    database: z.string().trim().max(128, 'Postgres database name can be at most 128 characters.').optional(),
    username: z.string().trim().max(128, 'Postgres username can be at most 128 characters.').optional(),
    password: z.string().max(1024, 'Postgres password can be at most 1024 characters.').optional(),
    sslMode: z.enum(['disable', 'require']).optional(),
  })
  .superRefine((values, context) => {
    if (!values.host?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Postgres host cannot be empty.',
        path: ['host'],
      });
    }

    if (!values.database?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Postgres database name cannot be empty.',
        path: ['database'],
      });
    }

    if (!values.username?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Postgres username cannot be empty.',
        path: ['username'],
      });
    }

    const port = Number(values.port?.trim() || POSTGRES_DEFAULT_PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Postgres port must be an integer between 1 and 65535.',
        path: ['port'],
      });
    }
  });

type MysqlFormValues = z.infer<typeof mysqlFormSchema>;
type PostgresFormValues = z.infer<typeof postgresFormSchema>;

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

function toMysqlPayload(values: MysqlFormValues): UpdateDatabaseSettingsDto {
  return {
    mysql: {
      host: values.host?.trim() ?? '',
      port: values.port?.trim() || MYSQL_DEFAULT_PORT,
      socketPath: values.socketPath?.trim() ?? '',
      instanceConnectionName: values.instanceConnectionName?.trim() ?? '',
      ipType: (values.ipType ?? DEFAULT_MYSQL_IP_TYPE) as MysqlIpTypeDto,
      database: values.database?.trim() ?? '',
      username: values.username?.trim() ?? '',
      password: values.password ?? '',
      sslMode: (values.sslMode ?? DEFAULT_MYSQL_SSL_MODE) as MysqlSslModeDto,
    },
  };
}

function toPostgresPayload(values: PostgresFormValues): UpdateDatabaseSettingsDto {
  return {
    postgres: {
      host: values.host?.trim() ?? '',
      port: values.port?.trim() || POSTGRES_DEFAULT_PORT,
      database: values.database?.trim() ?? '',
      username: values.username?.trim() ?? '',
      password: values.password ?? '',
      sslMode: (values.sslMode ?? DEFAULT_POSTGRES_SSL_MODE) as PostgresSslModeDto,
    },
  };
}

function activeDatabaseLabel(settings: DatabaseSettingsDto): string {
  if (settings.activeProvider === 'mysql') {
    return 'MySQL relational active';
  }
  if (settings.activeProvider === 'postgres') {
    return 'Postgres relational active';
  }
  return 'Relational database is not configured';
}

export function SettingsWorkspace() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [activeAction, setActiveAction] = useState<DatabaseAction | null>(null);

  const settingsQuery = useQuery({
    queryKey: ['database-settings'],
    queryFn: () => apiRequest<DatabaseSettingsDto>('/api/settings/database'),
  });

  const mysqlForm = useForm<MysqlFormValues>({
    resolver: zodResolver(mysqlFormSchema),
    defaultValues: {
      host: '',
      port: MYSQL_DEFAULT_PORT,
      socketPath: '',
      instanceConnectionName: '',
      ipType: DEFAULT_MYSQL_IP_TYPE,
      database: '',
      username: '',
      password: '',
      sslMode: DEFAULT_MYSQL_SSL_MODE,
    },
  });

  const postgresForm = useForm<PostgresFormValues>({
    resolver: zodResolver(postgresFormSchema),
    defaultValues: {
      host: '',
      port: POSTGRES_DEFAULT_PORT,
      database: '',
      username: '',
      password: '',
      sslMode: DEFAULT_POSTGRES_SSL_MODE,
    },
  });

  const resetForms = useCallback((settings: DatabaseSettingsDto) => {
    mysqlForm.reset({
      host: settings.mysqlDatabase?.host ?? '',
      port: String(settings.mysqlDatabase?.port ?? MYSQL_DEFAULT_PORT),
      socketPath: settings.mysqlDatabase?.socketPath ?? '',
      instanceConnectionName: settings.mysqlDatabase?.instanceConnectionName ?? '',
      ipType: settings.mysqlDatabase?.ipType ?? DEFAULT_MYSQL_IP_TYPE,
      database: settings.mysqlDatabase?.database ?? '',
      username: settings.mysqlDatabase?.username ?? '',
      password: '',
      sslMode: settings.mysqlDatabase?.sslMode ?? DEFAULT_MYSQL_SSL_MODE,
    });
    postgresForm.reset({
      host: settings.postgresDatabase?.host ?? '',
      port: String(settings.postgresDatabase?.port ?? POSTGRES_DEFAULT_PORT),
      database: settings.postgresDatabase?.database ?? '',
      username: settings.postgresDatabase?.username ?? '',
      password: '',
      sslMode: settings.postgresDatabase?.sslMode ?? DEFAULT_POSTGRES_SSL_MODE,
    });
  }, [mysqlForm, postgresForm]);

  useEffect(() => {
    if (settingsQuery.data) {
      resetForms(settingsQuery.data);
    }
  }, [resetForms, settingsQuery.data]);

  const updateMutation = useMutation({
    mutationFn: ({ payload }: { payload: UpdateDatabaseSettingsDto }) =>
      apiRequest<DatabaseSettingsDto>('/api/settings/database', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['database-settings'], data);
      resetForms(data);
      setNotice({
        tone: 'success',
        message: `${data.activeProvider === 'mysql' ? 'MySQL' : 'Postgres'} relational database settings were saved.`,
      });
    },
    onError: (error) => {
      setNotice({
        tone: 'error',
        message:
          error instanceof ApiRequestError || error instanceof Error
            ? error.message
            : 'Database setting could not be updated.',
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
          ? `${data.message} Target: ${data.resolvedDatabaseUrl}`
          : data.message,
      });
    },
    onError: (error) => {
      setNotice({
        tone: 'error',
        message:
          error instanceof ApiRequestError || error instanceof Error
            ? error.message
            : 'Database connection could not be tested.',
      });
    },
    onSettled: () => {
      setActiveAction(null);
    },
  });

  const isBusy = settingsQuery.isLoading || updateMutation.isPending || connectionTestMutation.isPending;
  const settings = settingsQuery.data;
  const mysqlSslMode = (mysqlForm.watch('sslMode') ?? DEFAULT_MYSQL_SSL_MODE) as MysqlSslModeDto;
  const mysqlIpType = (mysqlForm.watch('ipType') ?? DEFAULT_MYSQL_IP_TYPE) as MysqlIpTypeDto;
  const postgresSslMode = (postgresForm.watch('sslMode') ?? DEFAULT_POSTGRES_SSL_MODE) as PostgresSslModeDto;

  const saveMysql = mysqlForm.handleSubmit((values) => {
    setNotice(null);
    setActiveAction('mysql-save');
    updateMutation.mutate({ payload: toMysqlPayload(values) });
  });

  const testMysql = mysqlForm.handleSubmit((values) => {
    setNotice(null);
    setActiveAction('mysql-test');
    connectionTestMutation.mutate({ payload: toMysqlPayload(values) });
  });

  const savePostgres = postgresForm.handleSubmit((values) => {
    setNotice(null);
    setActiveAction('postgres-save');
    updateMutation.mutate({ payload: toPostgresPayload(values) });
  });

  const testPostgres = postgresForm.handleSubmit((values) => {
    setNotice(null);
    setActiveAction('postgres-test');
    connectionTestMutation.mutate({ payload: toPostgresPayload(values) });
  });

  const isActionPending = (action: DatabaseAction) =>
    activeAction === action && (updateMutation.isPending || connectionTestMutation.isPending);

  if (settingsQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Database Settings" />
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
              Try again
            </Button>
          }
          title="Database Settings"
        />

        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Database settings could not be read</CardTitle>
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

  return (
    <div className="space-y-6">
      <PageHeader title="Database Settings" />

      <Card className="border-border/60 bg-card/80">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle>Active Database</CardTitle>
              <p className="text-sm text-muted-foreground">
                Runtime checks env values first, then the config file. A MySQL or Postgres relational target is
                required in production; local SQLite fallback is only for non-production/test use.
              </p>
            </div>
            <Badge className="w-fit" variant={settings.isUsingExternalDatabase ? 'default' : 'secondary'}>
              {activeDatabaseLabel(settings)}
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
                Active database
              </div>
              <p className="mt-3 break-all text-sm leading-6 text-muted-foreground">
                {settings.activeDatabaseUrl}
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/30 p-5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Server className="h-4 w-4" />
                Runtime model
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Normalized relational tables, revisions, and composition relationships are protected with DB constraints.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <CardTitle>MySQL Connection Details</CardTitle>
              <p className="text-sm text-muted-foreground">
                Cloud Run should use the Cloud SQL Connector with an instance connection name. TCP host details and
                Unix sockets remain available for compatible environments.
              </p>
            </div>
            {settings.mysqlDatabase?.configuredFromEnvironment ? (
              <Badge className="w-fit" variant="secondary">Environment override active</Badge>
            ) : null}
          </div>
        </CardHeader>

        <CardContent>
          <form className="grid gap-5 md:grid-cols-2" onSubmit={(event) => event.preventDefault()}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="mysqlHost">Host</Label>
              <Input id="mysqlHost" placeholder="10.0.0.5" {...mysqlForm.register('host')} />
              {mysqlForm.formState.errors.host ? (
                <p className="text-sm text-destructive">{mysqlForm.formState.errors.host.message}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="mysqlPort">Port</Label>
              <Input id="mysqlPort" inputMode="numeric" placeholder={MYSQL_DEFAULT_PORT} {...mysqlForm.register('port')} />
              {mysqlForm.formState.errors.port ? (
                <p className="text-sm text-destructive">{mysqlForm.formState.errors.port.message}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="mysqlInstanceConnectionName">Cloud SQL instance connection name</Label>
              <Input
                id="mysqlInstanceConnectionName"
                placeholder="project:region:instance"
                {...mysqlForm.register('instanceConnectionName')}
              />
              {mysqlForm.formState.errors.instanceConnectionName ? (
                <p className="text-sm text-destructive">{mysqlForm.formState.errors.instanceConnectionName.message}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="mysqlIpType">Cloud SQL IP type</Label>
              <Select
                onValueChange={(value) =>
                  mysqlForm.setValue('ipType', value as MysqlIpTypeDto, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                value={mysqlIpType}
              >
                <SelectTrigger id="mysqlIpType">
                  <SelectValue placeholder="IP type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="PUBLIC">PUBLIC</SelectItem>
                    <SelectItem value="PRIVATE">PRIVATE</SelectItem>
                    <SelectItem value="PSC">PSC</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="mysqlSocketPath">Cloud SQL socket path</Label>
              <Input
                id="mysqlSocketPath"
                placeholder="/cloudsql/project:region:instance"
                {...mysqlForm.register('socketPath')}
              />
              {mysqlForm.formState.errors.socketPath ? (
                <p className="text-sm text-destructive">{mysqlForm.formState.errors.socketPath.message}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="mysqlDatabase">Database</Label>
              <Input id="mysqlDatabase" placeholder="open_story" {...mysqlForm.register('database')} />
              {mysqlForm.formState.errors.database ? (
                <p className="text-sm text-destructive">{mysqlForm.formState.errors.database.message}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="mysqlUsername">Username</Label>
              <Input id="mysqlUsername" autoComplete="username" placeholder="open_story_app" {...mysqlForm.register('username')} />
              {mysqlForm.formState.errors.username ? (
                <p className="text-sm text-destructive">{mysqlForm.formState.errors.username.message}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="mysqlPassword">Password</Label>
              <Input
                id="mysqlPassword"
                autoComplete="current-password"
                placeholder={settings.mysqlDatabase?.passwordConfigured ? 'Existing password is preserved' : '••••••••'}
                type="password"
                {...mysqlForm.register('password')}
              />
              {mysqlForm.formState.errors.password ? (
                <p className="text-sm text-destructive">{mysqlForm.formState.errors.password.message}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="mysqlSslMode">SSL mode</Label>
              <Select
                onValueChange={(value) =>
                  mysqlForm.setValue('sslMode', value as MysqlSslModeDto, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                value={mysqlSslMode}
              >
                <SelectTrigger id="mysqlSslMode">
                  <SelectValue placeholder="SSL mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="disable">disable</SelectItem>
                    <SelectItem value="require">require</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row md:col-span-2">
              <Button disabled={isBusy} onClick={testMysql} type="button" variant="outline">
                {isActionPending('mysql-test') ? 'Testing...' : 'Test MySQL connection'}
              </Button>
              <Button
                disabled={isBusy || settings.mysqlDatabase?.configuredFromEnvironment}
                onClick={saveMysql}
                type="button"
              >
                {settings.mysqlDatabase?.configuredFromEnvironment
                  ? 'Managed by environment'
                  : isActionPending('mysql-save')
                    ? 'Saving...'
                    : 'Save MySQL settings'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle>Postgres Connection Details</CardTitle>
        </CardHeader>

        <CardContent>
          <form className="grid gap-5 md:grid-cols-2" onSubmit={(event) => event.preventDefault()}>
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="postgresHost">Host</Label>
              <Input id="postgresHost" placeholder="db.project-ref.supabase.co" {...postgresForm.register('host')} />
              {postgresForm.formState.errors.host ? (
                <p className="text-sm text-destructive">{postgresForm.formState.errors.host.message}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="postgresPort">Port</Label>
              <Input id="postgresPort" inputMode="numeric" placeholder={POSTGRES_DEFAULT_PORT} {...postgresForm.register('port')} />
              {postgresForm.formState.errors.port ? (
                <p className="text-sm text-destructive">{postgresForm.formState.errors.port.message}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="postgresDatabase">Database</Label>
              <Input id="postgresDatabase" placeholder="postgres" {...postgresForm.register('database')} />
              {postgresForm.formState.errors.database ? (
                <p className="text-sm text-destructive">{postgresForm.formState.errors.database.message}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="postgresUsername">Username</Label>
              <Input id="postgresUsername" autoComplete="username" placeholder="postgres" {...postgresForm.register('username')} />
              {postgresForm.formState.errors.username ? (
                <p className="text-sm text-destructive">{postgresForm.formState.errors.username.message}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="postgresPassword">Password</Label>
              <Input
                id="postgresPassword"
                autoComplete="current-password"
                placeholder={settings.postgresDatabase?.passwordConfigured ? 'Existing password is preserved' : '••••••••'}
                type="password"
                {...postgresForm.register('password')}
              />
              {postgresForm.formState.errors.password ? (
                <p className="text-sm text-destructive">{postgresForm.formState.errors.password.message}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="postgresSslMode">SSL mode</Label>
              <Select
                onValueChange={(value) =>
                  postgresForm.setValue('sslMode', value as PostgresSslModeDto, {
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
            </div>

            <div className="flex flex-col gap-3 sm:flex-row md:col-span-2">
              <Button disabled={isBusy} onClick={testPostgres} type="button" variant="outline">
                {isActionPending('postgres-test') ? 'Testing...' : 'Test Postgres connection'}
              </Button>
              <Button disabled={isBusy} onClick={savePostgres} type="button">
                {isActionPending('postgres-save') ? 'Saving...' : 'Save Postgres settings'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
