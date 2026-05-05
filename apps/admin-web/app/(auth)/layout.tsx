import { Card, CardHeader, CardTitle } from '@open-story/ui/components/card';
import { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.1fr)]">
        <Card className="rounded-[28px] border-white/10 bg-[linear-gradient(180deg,rgba(18,24,39,0.92)_0%,rgba(8,12,20,0.92)_100%)] text-white shadow-[0_32px_100px_-52px_rgba(0,0,0,1)]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
            </div>
            <CardTitle className="text-3xl">Hesap erişimi</CardTitle>
          </CardHeader>
        </Card>

        <div>{children}</div>
      </div>
    </div>
  );
}
