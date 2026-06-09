'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ApiRequestError, apiRequest } from '@/lib/api';

export function useAdminLogout() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const logout = async () => {
    setIsSubmitting(true);

    try {
      await apiRequest<void>('/api/auth/logout', {
        method: 'POST',
        suppressAuthRedirect: true,
      });
    } catch (error) {
      if (!(error instanceof ApiRequestError)) {
        console.error(error);
      }
    } finally {
      router.replace('/login');
      router.refresh();
    }
  };

  return {
    isSubmitting,
    logout,
  };
}
