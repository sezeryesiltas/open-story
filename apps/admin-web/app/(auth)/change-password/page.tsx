'use client';

import type { AuthSessionResponseDto } from '@open-story/contracts';
import { Button } from '@open-story/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@open-story/ui/components/card';
import { Input } from '@open-story/ui/components/input';
import { Label } from '@open-story/ui/components/label';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

import { ApiRequestError, apiRequest } from '@/lib/api';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const hydrateSession = async () => {
      try {
        const response = await apiRequest<AuthSessionResponseDto>('/api/auth/me');
        if (cancelled) {
          return;
        }

        if (!response.user.mustChangePassword) {
          router.replace('/');
          router.refresh();
        }
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
      setErrorMessage('Yeni şifre ve tekrar alanı aynı olmalıdır.');
      return;
    }

    setIsSubmitting(true);

    try {
      await apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: temporaryPassword,
          newPassword,
        }),
      });

      router.replace('/');
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof ApiRequestError || error instanceof Error
          ? error.message
          : 'Şifre güncellenemedi.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.03)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_32px_80px_-44px_rgba(0,0,0,1)]">
      <CardHeader>
        <CardTitle>Change Password</CardTitle>
        <CardDescription>Devam etmek için şifrenizi yenileyin.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="temporaryPassword">Geçici şifre</Label>
            <Input
              id="temporaryPassword"
              onChange={(event) => setTemporaryPassword(event.target.value)}
              type="password"
              value={temporaryPassword}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">Yeni şifre</Label>
            <Input id="newPassword" onChange={(event) => setNewPassword(event.target.value)} type="password" value={newPassword} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Yeni şifre tekrar</Label>
            <Input
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

          <Button className="w-full" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Şifre güncelleniyor...' : 'Şifreyi güncelle'}
          </Button>
        </form>

        <div className="rounded-3xl border border-white/10 bg-black/20 p-5 text-sm leading-6 text-slate-400">
          Geçici şifreyle giriş yapan kullanıcıların önce yeni bir şifre belirlemesi gerekir.
        </div>
      </CardContent>
    </Card>
  );
}
