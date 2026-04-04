'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@open-story/ui/components/badge';
import { Button } from '@open-story/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@open-story/ui/components/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@open-story/ui/components/dialog';
import { Input } from '@open-story/ui/components/input';
import { Label } from '@open-story/ui/components/label';
import { Skeleton } from '@open-story/ui/components/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@open-story/ui/components/table';
import { RefreshCcw, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/admin/page-header';
import { ApiRequestError, apiRequest } from '@/lib/api';

type AdminUserApiRecord = {
  id: string;
  email: string;
  mustChangePassword: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function LoadingState() {
  return <Skeleton className="h-80 w-full rounded-xl" />;
}

export function UsersWorkspace() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => apiRequest<AdminUserApiRecord[]>('/api/admin-users'),
  });

  const users = usersQuery.data ?? [];
  const activeUserCount = useMemo(() => users.filter((user) => user.isActive).length, [users]);

  const createUserMutation = useMutation({
    mutationFn: () =>
      apiRequest<AdminUserApiRecord>('/api/admin-users', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          temporaryPassword,
        }),
      }),
    onSuccess: async (user) => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setNotice(`${user.email} oluşturuldu. Temporary password: ${temporaryPassword}`);
      setEmail('');
      setTemporaryPassword('');
      setCreateError(null);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: () => {
      if (!resetUserId) {
        throw new Error('Reset yapılacak kullanıcı seçilmedi.');
      }

      return apiRequest<AdminUserApiRecord>(`/api/admin-users/${resetUserId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({
          temporaryPassword: resetPassword,
        }),
      });
    },
    onSuccess: async (user) => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setNotice(`${user.email} için temporary password resetlendi: ${resetPassword}`);
      setResetError(null);
      setResetPassword('');
      setResetUserId(null);
    },
  });

  const handleCreateUser = async () => {
    setCreateError(null);
    setNotice(null);

    if (!email.trim() || !temporaryPassword.trim()) {
      setCreateError('Email ve temporary password zorunludur.');
      return;
    }

    try {
      await createUserMutation.mutateAsync();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Admin user oluşturulamadı.');
    }
  };

  const handleResetPassword = async () => {
    setResetError(null);
    setNotice(null);

    if (!resetPassword.trim()) {
      setResetError('Temporary password zorunludur.');
      return;
    }

    try {
      await resetPasswordMutation.mutateAsync();
    } catch (error) {
      setResetError(error instanceof Error ? error.message : 'Temporary password reset yapılamadı.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        description="Yönetici hesaplarını buradan ekleyebilir ve şifrelerini sıfırlayabilirsiniz."
        eyebrow="Users"
        title="Kullanıcı yönetimi"
      />

      {notice ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="px-6 py-4 text-sm leading-6">{notice}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Yeni admin oluştur</CardTitle>
            <CardDescription>
              Yeni kullanıcı ilk girişte şifresini yeniler.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adminUserEmail">Email</Label>
              <Input
                id="adminUserEmail"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="editor@openstory.local"
                value={email}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminUserPassword">Temporary password</Label>
              <Input
                id="adminUserPassword"
                onChange={(event) => setTemporaryPassword(event.target.value)}
                placeholder="Temp#2026!"
                type="text"
                value={temporaryPassword}
              />
            </div>

            {createError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {createError}
              </div>
            ) : null}

            <Button className="gap-2" disabled={createUserMutation.isPending} onClick={handleCreateUser} type="button">
              <UserPlus className="h-4 w-4" />
              {createUserMutation.isPending ? 'Oluşturuluyor...' : 'Admin oluştur'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Kullanıcı özeti</CardTitle>
              <Badge variant="secondary">{activeUserCount} active</Badge>
            </div>
            <CardDescription>Toplam aktif yönetici sayısı.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Bu alanda tüm yönetici hesaplarını görebilirsiniz.</p>
            <p>Şifresini yenilemesi gereken kullanıcılar tabloda işaretlenir.</p>
          </CardContent>
        </Card>
      </div>

      {usersQuery.isLoading ? <LoadingState /> : null}

      {usersQuery.isError ? (
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Admin user listesi yüklenemedi</CardTitle>
            <CardDescription>
              {(usersQuery.error as ApiRequestError | Error | undefined)?.message ??
                'Admin user listesi okunamadı.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="gap-2" onClick={() => usersQuery.refetch()} variant="outline">
              <RefreshCcw className="h-4 w-4" />
              Tekrar dene
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!usersQuery.isLoading && !usersQuery.isError ? (
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Admin user listesi</CardTitle>
            <CardDescription>Şifresini sıfırlamak istediğiniz kullanıcıyı listeden seçin.</CardDescription>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <div className="rounded-lg border border-border/60 border-dashed px-4 py-8 text-sm text-muted-foreground">
                Henüz admin user kaydı görünmüyor.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Password</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? 'default' : 'secondary'}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.mustChangePassword ? 'secondary' : 'outline'}>
                          {user.mustChangePassword ? 'Şifre yenile' : 'Hazır'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(user.createdAt)}</TableCell>
                      <TableCell>{formatDate(user.updatedAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button onClick={() => setResetUserId(user.id)} size="sm" type="button" variant="outline">
                          Reset password
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setResetUserId(null);
            setResetPassword('');
            setResetError(null);
          }
        }}
        open={Boolean(resetUserId)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Geçici şifre belirle</DialogTitle>
            <DialogDescription>
              Kullanıcı bir sonraki girişte bu şifreyi kullanır ve ardından yeni şifre belirler.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="resetPassword">Yeni temporary password</Label>
              <Input
                id="resetPassword"
                onChange={(event) => setResetPassword(event.target.value)}
                placeholder="Reset#2026!"
                type="text"
                value={resetPassword}
              />
            </div>

            {resetError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {resetError}
              </div>
            ) : null}

            <div className="flex justify-end gap-3">
              <Button onClick={() => setResetUserId(null)} type="button" variant="outline">
                Vazgeç
              </Button>
              <Button disabled={resetPasswordMutation.isPending} onClick={handleResetPassword} type="button">
                {resetPasswordMutation.isPending ? 'Resetleniyor...' : 'Reset password'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
