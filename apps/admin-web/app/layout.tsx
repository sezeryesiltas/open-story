import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';

import { Providers } from '@/components/admin/providers';

import './globals.css';

const manrope = Manrope({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'Open Story Admin',
    template: '%s | Open Story Admin'
  },
  description: 'Open Story v1 admin console'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body
        className={`${manrope.className} min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(116,173,255,0.24),transparent_28%),radial-gradient(circle_at_78%_18%,rgba(125,92,255,0.18),transparent_22%),radial-gradient(circle_at_bottom,rgba(22,163,74,0.12),transparent_25%),linear-gradient(180deg,#070b14_0%,#0a1020_38%,#0d1322_100%)]`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
