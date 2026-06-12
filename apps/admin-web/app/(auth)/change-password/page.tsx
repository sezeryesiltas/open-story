'use client';

import type { AuthSessionResponseDto } from '@open-story/contracts';
import { Button } from '@open-story/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@open-story/ui/components/card';
import { Input } from '@open-story/ui/components/input';
import { Label } from '@open-story/ui/components/label';
import { cn } from '@open-story/ui/lib/utils';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

import { ApiRequestError, apiRequest } from '@/lib/api';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mustChangePassword, setMustChangePassword] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const hydrateSession = async () => {
      try {
        const response = await apiRequest<AuthSessionResponseDto>('/api/auth/me', {
          suppressAuthRedirect: true,
        });
        if (cancelled) {
          return;
        }

        setMustChangePassword(response.user.mustChangePassword);
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
          router.replace('/login');
          router.refresh();
        }
      }
    };

    void hydrateSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirmation must match.');
      return;
    }

    setIsSubmitting(true);

    try {
      await apiRequest('/api/auth/change-password', {
        method: 'POST',
        suppressAuthRedirect: true,
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      router.replace('/');
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof ApiRequestError || error instanceof Error
          ? error.message
          : 'Password could not be updated.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.replace('/');
    router.refresh();
  };

  const canCancel = mustChangePassword === false;
  const currentPasswordLabel = mustChangePassword ? 'Temporary password' : 'Current password';
  const currentPasswordHelp = mustChangePassword
    ? 'Set a permanent password before continuing to the console.'
    : 'Use the password you currently sign in with.';

  return (
    <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.03)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_32px_80px_-44px_rgba(0,0,0,1)]">
      <CardHeader>
        <CardTitle>Change Password</CardTitle>
        <CardDescription>{currentPasswordHelp}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="currentPassword">{currentPasswordLabel}</Label>
            <Input
              autoComplete="current-password"
              id="currentPassword"
              onChange={(event) => setCurrentPassword(event.target.value)}
              type="password"
              value={currentPassword}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              autoComplete="new-password"
              id="newPassword"
              onChange={(event) => setNewPassword(event.target.value)}
              type="password"
              value={newPassword}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              autoComplete="new-password"
              id="confirmPassword"
              onChange={(event) => setConfirmPassword(event.target.value)}
              type="password"
              value={confirmPassword}
            />
          </div>

          {errorMessage ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {canCancel ? (
              <Button disabled={isSubmitting} onClick={handleCancel} type="button" variant="outline">
                Cancel
              </Button>
            ) : null}
            <Button
              className={cn(canCancel && 'sm:min-w-40', !canCancel && 'w-full')}
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? 'Updating password...' : 'Update password'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
