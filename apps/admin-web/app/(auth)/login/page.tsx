'use client';

import type { AuthSessionResponseDto } from '@open-story/contracts';
import { Button } from '@open-story/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@open-story/ui/components/card';
import { Input } from '@open-story/ui/components/input';
import { Label } from '@open-story/ui/components/label';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

import { ApiRequestError, apiRequest } from '@/lib/api';

type LoginResponse = {
  user: {
    mustChangePassword: boolean;
  };
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@openstory.local');
  const [password, setPassword] = useState('');
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

        router.replace(response.user.mustChangePassword ? '/change-password' : '/');
        router.refresh();
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
          return;
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
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await apiRequest<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
        }),
      });

      router.replace(response.user.mustChangePassword ? '/change-password' : '/');
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof ApiRequestError || error instanceof Error
          ? error.message
          : 'Login başarısız oldu.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.03)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_32px_80px_-44px_rgba(0,0,0,1)]">
      <CardHeader>
        <CardTitle>Login</CardTitle>
        <CardDescription>Email + password ile gerçek admin session açılır.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Temporary password"
              type="password"
              value={password}
            />
          </div>

          {errorMessage ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}

          <Button className="w-full" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Giriş yapılıyor...' : 'Giriş yap'}
          </Button>
        </form>

        <div className="rounded-3xl border border-white/10 bg-black/20 p-5 text-sm leading-6 text-slate-400">
          Başarılı login sonrası kullanıcı dashboard&apos;a geçer. `mustChangePassword = true`
          olan hesaplar doğrudan `Change Password` akışına yönlendirilir.
        </div>
      </CardContent>
    </Card>
  );
}
