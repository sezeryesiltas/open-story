import type { Metadata } from 'next';

import { Providers } from '@/components/admin/providers';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Open Story Admin',
    template: '%s | Open Story Admin'
  },
  description: 'Open Story yönetim paneli'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body className="min-h-screen bg-background font-sans text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
