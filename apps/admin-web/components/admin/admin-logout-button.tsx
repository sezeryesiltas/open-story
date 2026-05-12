'use client';

import { Button } from '@open-story/ui/components/button';
import { LogOut } from 'lucide-react';

import { useAdminLogout } from '@/lib/use-admin-logout';

export function AdminLogoutButton() {
  const { isSubmitting, logout } = useAdminLogout();

  return (
    <Button className="gap-2" disabled={isSubmitting} onClick={logout} size="sm" variant="outline">
      <LogOut className="h-4 w-4" />
      Sign out
    </Button>
  );
}
