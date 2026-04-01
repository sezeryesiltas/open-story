import { Badge } from '@open-story/ui/components/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@open-story/ui/components/card';
import { ReactNode } from 'react';

const authRules = [
  'Email + password auth',
  'Single role only',
  'Admin-created users with temporary password',
  'First login requires password change'
];

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
            <Badge
              className="mt-4 w-fit rounded-full border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-300 hover:bg-white/[0.06]"
              variant="secondary"
            >
              Open Story v1
            </Badge>
            <CardTitle className="text-3xl">Admin auth foundation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-slate-400">
            <p>
              Bu auth ekranları shell’in giriş yüzeyini sabitler. Gerçek backend entegrasyonu ve
              session yönetimi sonraki iterasyonda bağlanacak.
            </p>

            <ul className="space-y-3">
              {authRules.map((rule) => (
                <li key={rule} className="flex items-start gap-3">
                  <span className="mt-2 h-2 w-2 rounded-full bg-sky-300" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div>{children}</div>
      </div>
    </div>
  );
}
