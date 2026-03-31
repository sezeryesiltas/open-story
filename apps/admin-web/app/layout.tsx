import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { Providers } from '@/components/admin/providers';

import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Open Story Admin',
  description: 'Open Story v1 admin console'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
