import { PlacementsWorkspace } from '@/components/admin/placements-workspace';
import { requireAdminPageAccess } from '@/lib/server/admin-session';

export default async function PlacementsPage() {
  await requireAdminPageAccess('/placements');

  return <PlacementsWorkspace />;
}
