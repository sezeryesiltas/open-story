'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@open-story/ui/components/badge';
import { Button } from '@open-story/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@open-story/ui/components/card';
import { Input } from '@open-story/ui/components/input';
import { Label } from '@open-story/ui/components/label';
import { Skeleton } from '@open-story/ui/components/skeleton';
import { Switch } from '@open-story/ui/components/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@open-story/ui/components/table';
import { Copy, KeyRound, RefreshCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { PageHeader } from '@/components/admin/page-header';
import { ApiRequestError, apiRequest } from '@/lib/api';

type ClientApiRecord = {
  id: string;
  clientId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type StaticTokenApiRecord = {
  id: string;
  clientId: string;
  label: string;
  tokenPrefix: string;
  isActive: boolean;
  createdAt: string;
  revokedAt: string | null;
};

type CreateStaticTokenResponse = {
  token: StaticTokenApiRecord;
  plainTextToken: string;
};

type AdminApiKeyApiRecord = {
  id: string;
  clientName: string;
  keyPrefix: string;
  isActive: boolean;
  createdAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
};

type CreateAdminApiKeyResponse = {
  apiKey: AdminApiKeyApiRecord;
  plainTextApiKey: string;
  clientSecret: string;
};

type WorkspaceData = {
  client: ClientApiRecord;
  tokens: StaticTokenApiRecord[];
  adminApiKeys: AdminApiKeyApiRecord[];
};

function formatDate(value: string | null): string {
  if (!value) {
    return 'Never';
  }

  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function LoadingState() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <Skeleton className="h-72 w-full rounded-xl" />
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}

export function ClientWorkspace() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [tokenLabel, setTokenLabel] = useState('');
  const [apiClientName, setApiClientName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [revealedToken, setRevealedToken] = useState<CreateStaticTokenResponse | null>(null);
  const [revealedApiKey, setRevealedApiKey] = useState<CreateAdminApiKeyResponse | null>(null);

  const workspaceQuery = useQuery({
    queryKey: ['client-workspace'],
    queryFn: async (): Promise<WorkspaceData> => {
      const [client, tokens, adminApiKeys] = await Promise.all([
        apiRequest<ClientApiRecord>('/api/client'),
        apiRequest<StaticTokenApiRecord[]>('/api/client-tokens'),
        apiRequest<AdminApiKeyApiRecord[]>('/api/admin-api-keys'),
      ]);

      return { client, tokens, adminApiKeys };
    },
  });

  useEffect(() => {
    if (!workspaceQuery.data?.client) {
      return;
    }

    setName(workspaceQuery.data.client.name);
    setIsActive(workspaceQuery.data.client.isActive);
  }, [workspaceQuery.data?.client]);

  const activeTokenCount = useMemo(
    () => (workspaceQuery.data?.tokens ?? []).filter((token) => token.isActive).length,
    [workspaceQuery.data?.tokens],
  );

  const activeAdminApiKeyCount = useMemo(
    () => (workspaceQuery.data?.adminApiKeys ?? []).filter((apiKey) => apiKey.isActive).length,
    [workspaceQuery.data?.adminApiKeys],
  );

  const updateClientMutation = useMutation({
    mutationFn: () =>
      apiRequest<ClientApiRecord>('/api/client', {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          isActive,
        }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['client-workspace'] });
      setFormError(null);
    },
  });

  const createTokenMutation = useMutation({
    mutationFn: () =>
      apiRequest<CreateStaticTokenResponse>('/api/client-tokens', {
        method: 'POST',
        body: JSON.stringify({
          label: tokenLabel.trim(),
        }),
      }),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['client-workspace'] });
      setRevealedToken(response);
      setTokenLabel('');
      setTokenError(null);
    },
  });

  const revokeTokenMutation = useMutation({
    mutationFn: (tokenId: string) =>
      apiRequest<StaticTokenApiRecord>(`/api/client-tokens/${tokenId}/revoke`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['client-workspace'] });
    },
  });

  const createAdminApiKeyMutation = useMutation({
    mutationFn: () =>
      apiRequest<CreateAdminApiKeyResponse>('/api/admin-api-keys', {
        method: 'POST',
        body: JSON.stringify({
          clientName: apiClientName.trim(),
        }),
    }),
    onSuccess: async (response) => {
      queryClient.setQueryData<WorkspaceData>(['client-workspace'], (currentData) =>
        currentData
          ? {
              ...currentData,
              adminApiKeys: [
                response.apiKey,
                ...currentData.adminApiKeys.filter((apiKey) => apiKey.id !== response.apiKey.id),
              ],
            }
          : currentData,
      );
      await queryClient.invalidateQueries({ queryKey: ['client-workspace'] });
      setRevealedApiKey(response);
      setApiClientName('');
      setApiKeyError(null);
    },
  });

  const revokeAdminApiKeyMutation = useMutation({
    mutationFn: (keyId: string) =>
      apiRequest<AdminApiKeyApiRecord>(`/api/admin-api-keys/${keyId}/revoke`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: async (response) => {
      queryClient.setQueryData<WorkspaceData>(['client-workspace'], (currentData) =>
        currentData
          ? {
              ...currentData,
              adminApiKeys: currentData.adminApiKeys.map((apiKey) =>
                apiKey.id === response.id ? response : apiKey,
              ),
            }
          : currentData,
      );
      await queryClient.invalidateQueries({ queryKey: ['client-workspace'] });
    },
  });

  const handleSaveClient = async () => {
    setFormError(null);

    if (!name.trim()) {
      setFormError('Client adı zorunludur.');
      return;
    }

    try {
      await updateClientMutation.mutateAsync();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Client güncellenemedi.');
    }
  };

  const handleCreateToken = async () => {
    setTokenError(null);

    if (!tokenLabel.trim()) {
      setTokenError('Token label zorunludur.');
      return;
    }

    try {
      await createTokenMutation.mutateAsync();
    } catch (error) {
      setTokenError(error instanceof Error ? error.message : 'Static token oluşturulamadı.');
    }
  };

  const handleCreateAdminApiKey = async () => {
    setApiKeyError(null);

    if (!apiClientName.trim()) {
      setApiKeyError('Client name zorunludur.');
      return;
    }

    try {
      await createAdminApiKeyMutation.mutateAsync();
    } catch (error) {
      setApiKeyError(error instanceof Error ? error.message : 'Admin API key oluşturulamadı.');
    }
  };

  const handleCopyValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard failure is non-blocking for reveal cards.
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Client ve token yönetimi" />

      {workspaceQuery.isLoading ? <LoadingState /> : null}

      {workspaceQuery.isError ? (
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Client workspace yüklenemedi</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {(workspaceQuery.error as ApiRequestError | Error | undefined)?.message ??
                'Client ve token bilgileri okunamadı.'}
            </div>
            <Button className="gap-2" onClick={() => workspaceQuery.refetch()} variant="outline">
              <RefreshCcw className="h-4 w-4" />
              Tekrar dene
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!workspaceQuery.isLoading && !workspaceQuery.isError && workspaceQuery.data ? (
        <>
          {revealedToken ? (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle>Yeni static token</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="rounded-lg border border-border/60 bg-background px-4 py-3 break-all font-mono text-sm">
                  {revealedToken.plainTextToken}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button className="gap-2" onClick={() => handleCopyValue(revealedToken.plainTextToken)} type="button" variant="outline">
                    <Copy className="h-4 w-4" />
                    Kopyala
                  </Button>
                  <Button onClick={() => setRevealedToken(null)} type="button" variant="ghost">
                    Kapat
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {revealedApiKey ? (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle>Yeni admin API key</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">API Key</p>
                  <div className="rounded-lg border border-border/60 bg-background px-4 py-3 break-all font-mono text-sm">
                    {revealedApiKey.plainTextApiKey}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Client Secret</p>
                  <div className="rounded-lg border border-border/60 bg-background px-4 py-3 break-all font-mono text-sm">
                    {revealedApiKey.clientSecret}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button className="gap-2" onClick={() => handleCopyValue(revealedApiKey.plainTextApiKey)} type="button" variant="outline">
                    <Copy className="h-4 w-4" />
                    API key kopyala
                  </Button>
                  <Button className="gap-2" onClick={() => handleCopyValue(revealedApiKey.clientSecret)} type="button" variant="outline">
                    <Copy className="h-4 w-4" />
                    Secret kopyala
                  </Button>
                  <Button onClick={() => setRevealedApiKey(null)} type="button" variant="ghost">
                    Kapat
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <Card className="border-border/60 bg-card/80">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>Client ayarları</CardTitle>
                  <Badge variant={workspaceQuery.data.client.isActive ? 'default' : 'secondary'}>
                    {workspaceQuery.data.client.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg border border-border/60 bg-background/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Client ID</p>
                  <p className="mt-2 font-mono text-sm">{workspaceQuery.data.client.clientId}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clientName">Client adı</Label>
                  <Input id="clientName" onChange={(event) => setName(event.target.value)} value={name} />
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/70 px-4 py-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Client aktif</p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      Kapalıysa uygulama erişimi durdurulur.
                    </p>
                  </div>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>

                {formError ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {formError}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <Button disabled={updateClientMutation.isPending} onClick={handleSaveClient} type="button">
                    {updateClientMutation.isPending ? 'Kaydediliyor...' : 'Client güncelle'}
                  </Button>
                  <Badge variant="secondary">{activeTokenCount} aktif token</Badge>
                  <Badge variant="secondary">{activeAdminApiKeyCount} aktif admin key</Badge>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-6">
              <Card className="border-border/60 bg-card/80">
                <CardHeader>
                  <CardTitle>Yeni token</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="tokenLabel">Token adı</Label>
                    <Input
                      id="tokenLabel"
                      onChange={(event) => setTokenLabel(event.target.value)}
                      placeholder="Android production"
                      value={tokenLabel}
                    />
                  </div>

                  {tokenError ? (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      {tokenError}
                    </div>
                  ) : null}

                  <Button className="gap-2" disabled={createTokenMutation.isPending} onClick={handleCreateToken} type="button">
                    <KeyRound className="h-4 w-4" />
                    {createTokenMutation.isPending ? 'Üretiliyor...' : 'Static token üret'}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-card/80">
                <CardHeader>
                  <CardTitle>Yeni admin API key</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="apiClientName">Client name</Label>
                    <Input
                      id="apiClientName"
                      onChange={(event) => setApiClientName(event.target.value)}
                      placeholder="Content service production"
                      value={apiClientName}
                    />
                  </div>

                  {apiKeyError ? (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      {apiKeyError}
                    </div>
                  ) : null}

                  <Button className="gap-2" disabled={createAdminApiKeyMutation.isPending} onClick={handleCreateAdminApiKey} type="button">
                    <KeyRound className="h-4 w-4" />
                    {createAdminApiKeyMutation.isPending ? 'Üretiliyor...' : 'Admin API key üret'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle>Token listesi</CardTitle>
            </CardHeader>
            <CardContent>
              {(workspaceQuery.data.tokens ?? []).length === 0 ? (
                <div className="rounded-lg border border-border/60 border-dashed px-4 py-8 text-sm text-muted-foreground">
                  Henüz token yok. İlk token&apos;ı yukarıdaki formdan oluşturabilirsiniz.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Label</TableHead>
                      <TableHead>Prefix</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Revoked</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workspaceQuery.data.tokens.map((token) => (
                      <TableRow key={token.id}>
                        <TableCell className="font-medium">{token.label}</TableCell>
                        <TableCell className="font-mono text-xs">{token.tokenPrefix}</TableCell>
                        <TableCell>
                          <Badge variant={token.isActive ? 'default' : 'secondary'}>
                            {token.isActive ? 'Active' : 'Revoked'}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(token.createdAt)}</TableCell>
                        <TableCell>{formatDate(token.revokedAt)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            disabled={!token.isActive || revokeTokenMutation.isPending}
                            onClick={() => revokeTokenMutation.mutate(token.id)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            Revoke
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle>Admin API key listesi</CardTitle>
            </CardHeader>
            <CardContent>
              {(workspaceQuery.data.adminApiKeys ?? []).length === 0 ? (
                <div className="rounded-lg border border-border/60 border-dashed px-4 py-8 text-sm text-muted-foreground">
                  Henüz admin API key yok. İlk key&apos;i yukarıdaki formdan oluşturabilirsiniz.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client name</TableHead>
                      <TableHead>Prefix</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Last used</TableHead>
                      <TableHead>Revoked</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workspaceQuery.data.adminApiKeys.map((apiKey) => (
                      <TableRow key={apiKey.id}>
                        <TableCell className="font-medium">{apiKey.clientName}</TableCell>
                        <TableCell className="font-mono text-xs">{apiKey.keyPrefix}</TableCell>
                        <TableCell>
                          <Badge variant={apiKey.isActive ? 'default' : 'secondary'}>
                            {apiKey.isActive ? 'Active' : 'Revoked'}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(apiKey.createdAt)}</TableCell>
                        <TableCell>{formatDate(apiKey.lastUsedAt)}</TableCell>
                        <TableCell>{formatDate(apiKey.revokedAt)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            disabled={!apiKey.isActive || revokeAdminApiKeyMutation.isPending}
                            onClick={() => revokeAdminApiKeyMutation.mutate(apiKey.id)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            Revoke
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
