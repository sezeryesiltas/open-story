import { ReactNode } from 'react';

import { ConsoleShell } from '@/components/admin/console-shell';
import { requireConsoleSession } from '@/lib/server/admin-session';

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const session = await requireConsoleSession();

  return <ConsoleShell currentUserEmail={session.user.email}>{children}</ConsoleShell>;
}
