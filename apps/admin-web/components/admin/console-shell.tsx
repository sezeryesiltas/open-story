import { SidebarInset, SidebarProvider, SidebarTrigger } from '@open-story/ui/components/sidebar';
import type { AdminRole } from '@open-story/contracts';
import type { CSSProperties, ReactNode } from 'react';

import { AdminLogoutButton } from '@/components/admin/admin-logout-button';
import { AppSidebar } from '@/components/admin/app-sidebar';
import { getAdminRoleLabel } from '@/lib/admin-authorization';

export function ConsoleShell({
  children,
  currentUserEmail,
  currentUserRole,
}: {
  children: ReactNode;
  currentUserEmail: string;
  currentUserRole: AdminRole;
}) {
  const userInitial = currentUserEmail.trim().charAt(0).toUpperCase() || 'A';

  return (
    <SidebarProvider
      defaultOpen
      style={
        {
          '--sidebar-width': '20rem',
          '--sidebar-width-mobile': '18rem',
          '--sidebar-width-icon': '4.25rem'
        } as CSSProperties
      }
    >
      <AppSidebar currentUserRole={currentUserRole} />
      <SidebarInset>
        <div className="flex min-h-svh flex-col">
          <header className="flex h-20 shrink-0 items-center gap-4 border-b border-border/70 bg-background/95 px-4 transition-[width,height] ease-linear md:px-8">
            <div className="flex min-w-0 flex-1 items-center gap-5">
              <SidebarTrigger className="text-primary hover:bg-primary/10 hover:text-primary" />
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold">OpenStory Admin</span>
                <span className="text-xs text-muted-foreground">Dashboard</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden text-right sm:block">
                <div className="text-sm font-medium">{currentUserEmail}</div>
                <div className="text-xs text-muted-foreground">{getAdminRoleLabel(currentUserRole)}</div>
              </div>
              <div className="hidden size-10 items-center justify-center rounded-full border border-[hsl(var(--metric-purple)_/_0.45)] bg-[hsl(var(--metric-purple)_/_0.16)] text-sm font-semibold text-[hsl(var(--metric-purple))] sm:flex">
                {userInitial}
              </div>
              <AdminLogoutButton />
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-4 p-4 pt-6 md:p-8">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
