import { StorageSettingsWorkspace } from '@/components/admin/storage-settings-workspace';
import { requireAdminPageAccess } from '@/lib/server/admin-session';

export default async function StorageSettingsPage() {
  await requireAdminPageAccess('/settings/storage');

  return <StorageSettingsWorkspace />;
}
