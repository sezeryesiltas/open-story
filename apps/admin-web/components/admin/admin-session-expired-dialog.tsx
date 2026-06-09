'use client';

import type { QueryClient } from '@tanstack/react-query';
import { Button } from '@open-story/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@open-story/ui/components/dialog';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  ADMIN_AUTH_EXPIRED_EVENT,
  DEFAULT_ADMIN_AUTH_EXPIRED_MESSAGE,
  type AdminAuthExpiredEventDetail,
} from '@/lib/api';

export function AdminSessionExpiredDialog({ queryClient }: { queryClient: QueryClient }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState(DEFAULT_ADMIN_AUTH_EXPIRED_MESSAGE);

  useEffect(() => {
    const navigateToLogin = () => {
      if (pathname !== '/login') {
        router.replace('/login');
        router.refresh();
      }
    };

    const handleAuthExpired = (event: Event) => {
      const detail =
        event instanceof CustomEvent
          ? (event.detail as AdminAuthExpiredEventDetail | undefined)
          : undefined;

      setMessage(detail?.message ?? DEFAULT_ADMIN_AUTH_EXPIRED_MESSAGE);
      setIsOpen(true);
      queryClient.clear();
      navigateToLogin();
    };

    window.addEventListener(ADMIN_AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => {
      window.removeEventListener(ADMIN_AUTH_EXPIRED_EVENT, handleAuthExpired);
    };
  }, [pathname, queryClient, router]);

  const handleContinue = () => {
    setIsOpen(false);

    if (pathname !== '/login') {
      router.replace('/login');
      router.refresh();
    }
  };

  return (
    <Dialog onOpenChange={setIsOpen} open={isOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Session expired</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button className="w-full sm:w-auto" onClick={handleContinue} type="button">
            Go to sign in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
