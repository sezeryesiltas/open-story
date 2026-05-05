import { SettingsWorkspace } from '@/components/admin/settings-workspace';
import { requireAdminPageAccess } from '@/lib/server/admin-session';

export default async function SettingsPage() {
  await requireAdminPageAccess('/settings');

  return <SettingsWorkspace />;
}
