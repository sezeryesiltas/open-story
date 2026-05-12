'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@open-story/ui/components/badge';
import { Button } from '@open-story/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@open-story/ui/components/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@open-story/ui/components/dialog';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@open-story/ui/components/table';
import type { AdminRole } from '@open-story/contracts';
import { RefreshCcw, UserPlus } from 'lucide-react';
import { useState } from 'react';

import { PageHeader } from '@/components/admin/page-header';
import { adminRoleLabels } from '@/lib/admin-authorization';
import { ApiRequestError, apiRequest } from '@/lib/api';

type AdminUserApiRecord = {
  id: string;
  email: string;
  role: AdminRole;
  mustChangePassword: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const adminRoleOptions: Array<{ value: AdminRole; label: string; description: string }> = [
  {
    value: 'super_admin',
    label: adminRoleLabels.super_admin,
    description: 'All admin console permissions.',
  },
  {
    value: 'story_admin',
    label: adminRoleLabels.story_admin,
    description: 'Home and the full Content section.',
  },
  {
    value: 'story_editor',
    label: adminRoleLabels.story_editor,
    description: 'Home, Stories, Assets, and Preview.',
  },
];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function LoadingState() {
  return <Skeleton className="h-80 w-full rounded-xl" />;
}

export function UsersWorkspace({ currentUserId }: { currentUserId: string }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>('story_editor');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [roleUserId, setRoleUserId] = useState<string | null>(null);
  const [roleDraft, setRoleDraft] = useState<AdminRole>('story_editor');

  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => apiRequest<AdminUserApiRecord[]>('/api/admin-users'),
  });

  const users = usersQuery.data ?? [];
  const activeUserCount = users.filter((user) => user.isActive).length;
  const roleUser = users.find((user) => user.id === roleUserId) ?? null;

  const createUserMutation = useMutation({
    mutationFn: () =>
      apiRequest<AdminUserApiRecord>('/api/admin-users', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          role,
          temporaryPassword,
        }),
      }),
    onSuccess: async (user) => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setNotice(`${user.email} was created. Temporary password: ${temporaryPassword}`);
      setEmail('');
      setRole('story_editor');
      setTemporaryPassword('');
      setCreateError(null);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: () => {
      if (!resetUserId) {
        throw new Error('No user was selected for reset.');
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
      setNotice(`Temporary password was reset for ${user.email}: ${resetPassword}`);
      setResetError(null);
      setResetPassword('');
      setResetUserId(null);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: () => {
      if (!roleUserId) {
        throw new Error('No user was selected for role update.');
      }

      return apiRequest<AdminUserApiRecord>(`/api/admin-users/${roleUserId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({
          role: roleDraft,
        }),
      });
    },
    onSuccess: async (user) => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setNotice(`${user.email} role was updated to ${adminRoleLabels[user.role]}.`);
      setRoleError(null);
      setRoleUserId(null);
    },
  });

  const handleCreateUser = async () => {
    setCreateError(null);
    setNotice(null);

    if (!email.trim() || !temporaryPassword.trim()) {
      setCreateError('Email and temporary password are required.');
      return;
    }

    try {
      await createUserMutation.mutateAsync();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Admin user could not be created.');
    }
  };

  const handleResetPassword = async () => {
    setResetError(null);
    setNotice(null);

    if (!resetPassword.trim()) {
      setResetError('Temporary password is required.');
      return;
    }

    try {
      await resetPasswordMutation.mutateAsync();
    } catch (error) {
      setResetError(error instanceof Error ? error.message : 'Temporary password could not be reset.');
    }
  };

  const openRoleDialog = (user: AdminUserApiRecord) => {
    setNotice(null);
    setRoleError(null);
    setRoleUserId(user.id);
    setRoleDraft(user.role);
  };

  const handleUpdateRole = async () => {
    setRoleError(null);
    setNotice(null);

    if (!roleUserId) {
      setRoleError('No user was selected for role update.');
      return;
    }

    if (roleUserId === currentUserId) {
      setRoleError('A Super Admin cannot change their own role.');
      return;
    }

    try {
      await updateRoleMutation.mutateAsync();
    } catch (error) {
      setRoleError(error instanceof Error ? error.message : 'Admin user role could not be updated.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="User Management" />

      {notice ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="px-6 py-4 text-sm leading-6">{notice}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Create new admin</CardTitle>
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
            <div className="space-y-2">
              <Label htmlFor="adminUserRole">Role</Label>
              <Select onValueChange={(value) => setRole(value as AdminRole)} value={role}>
                <SelectTrigger id="adminUserRole">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {adminRoleOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <p className="text-xs leading-5 text-muted-foreground">
                {adminRoleOptions.find((option) => option.value === role)?.description}
              </p>
            </div>

            {createError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {createError}
              </div>
            ) : null}

            <Button className="gap-2" disabled={createUserMutation.isPending} onClick={handleCreateUser} type="button">
              <UserPlus className="h-4 w-4" />
              {createUserMutation.isPending ? 'Creating...' : 'Create admin'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>User Summary</CardTitle>
              <Badge variant="secondary">{activeUserCount} active</Badge>
            </div>
          </CardHeader>
        </Card>
      </div>

      {usersQuery.isLoading ? <LoadingState /> : null}

      {usersQuery.isError ? (
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Admin user list could not be loaded</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {(usersQuery.error as ApiRequestError | Error | undefined)?.message ??
                'Admin user list could not be read.'}
            </div>
            <Button className="gap-2" onClick={() => usersQuery.refetch()} variant="outline">
              <RefreshCcw className="h-4 w-4" />
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!usersQuery.isLoading && !usersQuery.isError ? (
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Admin User List</CardTitle>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <div className="rounded-lg border border-border/60 border-dashed px-4 py-8 text-sm text-muted-foreground">
                No admin user records are visible yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
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
                        <Badge variant="outline">{adminRoleLabels[user.role]}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? 'default' : 'secondary'}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.mustChangePassword ? 'secondary' : 'outline'}>
                          {user.mustChangePassword ? 'Password reset required' : 'Ready'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(user.createdAt)}</TableCell>
                      <TableCell>{formatDate(user.updatedAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            disabled={user.id === currentUserId}
                            onClick={() => openRoleDialog(user)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            Change role
                          </Button>
                          <Button onClick={() => setResetUserId(user.id)} size="sm" type="button" variant="outline">
                            Reset password
                          </Button>
                        </div>
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
            <DialogTitle>Set temporary password</DialogTitle>
            <DialogDescription>
              The user will use this password on the next sign-in and then set a new password.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="resetPassword">New temporary password</Label>
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
                Cancel
              </Button>
              <Button disabled={resetPasswordMutation.isPending} onClick={handleResetPassword} type="button">
                {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset password'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setRoleUserId(null);
            setRoleError(null);
          }
        }}
        open={Boolean(roleUserId)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change role</DialogTitle>
            <DialogDescription>
              {roleUser
                ? `Select a new role for ${roleUser.email}.`
                : 'Select a new role for the user.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editAdminUserRole">Role</Label>
              <Select onValueChange={(value) => setRoleDraft(value as AdminRole)} value={roleDraft}>
                <SelectTrigger id="editAdminUserRole">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {adminRoleOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {roleError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {roleError}
              </div>
            ) : null}

            <div className="flex justify-end gap-3">
              <Button onClick={() => setRoleUserId(null)} type="button" variant="outline">
                Cancel
              </Button>
              <Button
                disabled={updateRoleMutation.isPending || roleUser?.role === roleDraft}
                onClick={handleUpdateRole}
                type="button"
              >
                {updateRoleMutation.isPending ? 'Updating...' : 'Update role'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
