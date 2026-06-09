'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

import { AdminSessionExpiredDialog } from '@/components/admin/admin-session-expired-dialog';
import { shouldRetryApiRequest } from '@/lib/api';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: shouldRetryApiRequest,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <AdminSessionExpiredDialog queryClient={queryClient} />
    </QueryClientProvider>
  );
}
