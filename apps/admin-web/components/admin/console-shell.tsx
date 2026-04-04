import { Separator } from '@open-story/ui/components/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@open-story/ui/components/sidebar';
import type { CSSProperties, ReactNode } from 'react';

import { AdminLogoutButton } from '@/components/admin/admin-logout-button';
import { AppSidebar } from '@/components/admin/app-sidebar';

export function ConsoleShell({
  children,
  currentUserEmail,
}: {
  children: ReactNode;
  currentUserEmail: string;
}) {
  return (
    <SidebarProvider
      defaultOpen
      style={
        {
          '--sidebar-width': '17rem',
          '--sidebar-width-mobile': '18rem',
          '--sidebar-width-icon': '3.25rem'
        } as CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset>
        <div className="flex min-h-svh flex-col">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 transition-[width,height] ease-linear">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator className="mr-2 data-[orientation=vertical]:h-4" orientation="vertical" />
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-medium">Open Story Admin</span>
                <span className="text-xs text-muted-foreground">Placement-managed story operations</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <div className="text-sm font-medium">{currentUserEmail}</div>
                <div className="text-xs text-muted-foreground">Admin session aktif</div>
              </div>
              <AdminLogoutButton />
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-4 p-4 pt-4 md:p-6">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
