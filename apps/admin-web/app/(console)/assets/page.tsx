import { AssetsWorkspace } from '@/components/admin/assets-workspace';
import { requireAdminPageAccess } from '@/lib/server/admin-session';

export default async function AssetsPage() {
  await requireAdminPageAccess('/assets');

  return <AssetsWorkspace />;
}
