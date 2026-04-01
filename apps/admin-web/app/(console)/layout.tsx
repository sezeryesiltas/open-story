import { ReactNode } from 'react';

import { ConsoleShell } from '@/components/admin/console-shell';

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return <ConsoleShell>{children}</ConsoleShell>;
}
