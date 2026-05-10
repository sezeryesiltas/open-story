'use client';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '@open-story/ui/components/sidebar';
import type { AdminRole } from '@open-story/contracts';
import appIcon from '@/app/icon.png';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { getAdminNavSectionsForRole } from '@/lib/admin-navigation';
import { adminBuildInfo } from '@/lib/build-info';

function isActive(pathname: string, href: string) {
  if (href === '/') {
    return pathname === '/';
  }

  if (href === '/settings') {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({ currentUserRole }: { currentUserRole: AdminRole }) {
  const pathname = usePathname();
  const adminNavSections = getAdminNavSectionsForRole(currentUserRole);

  return (
    <Sidebar className="border-sidebar-border" collapsible="icon" variant="sidebar">
      <SidebarHeader className="px-5 py-6">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="h-auto gap-3 rounded-[8px] px-0 py-0 hover:bg-transparent hover:text-sidebar-foreground group-data-[collapsible=icon]:justify-center"
              size="lg"
            >
              <Link href="/">
                <div className="flex aspect-square size-10 shrink-0 items-center justify-center overflow-hidden rounded-[8px] group-data-[collapsible=icon]:size-8">
                  <Image
                    alt="OpenStory"
                    className="size-10 rounded-[8px] object-cover group-data-[collapsible=icon]:size-8"
                    priority
                    src={appIcon}
                  />
                </div>
                <div className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-semibold">OpenStory</span>
                  <span className="truncate text-xs text-sidebar-foreground/55">Admin</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-6 px-5 py-5">
        {adminNavSections.map((section) => (
          <SidebarGroup className="p-0" key={section.title}>
            <SidebarGroupLabel className="h-auto px-3 pb-3 text-[11px] font-semibold tracking-[0.22em] text-sidebar-foreground/40">
              {section.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const Icon = item.icon;

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        className="h-12 gap-3 rounded-[8px] border border-transparent px-3 text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground data-[active=true]:border-sidebar-primary/35 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-primary group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2"
                        isActive={isActive(pathname, item.href)}
                        tooltip={item.title}
                      >
                        <Link href={item.href}>
                          <Icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="border-t border-sidebar-border p-4 group-data-[collapsible=icon]:items-center">
        <div
          className="flex min-w-0 items-center gap-3 text-[11px] leading-4 text-sidebar-foreground/60"
          title={`Build ${adminBuildInfo.buildNumber}`}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-sidebar-primary/55 text-[10px] font-semibold uppercase text-sidebar-primary">
            OS
          </span>
          <span className="truncate group-data-[collapsible=icon]:hidden">
            v{adminBuildInfo.version} · {adminBuildInfo.buildNumber}
          </span>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
