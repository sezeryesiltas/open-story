import { ClientWorkspace } from '@/components/admin/client-workspace';
import { requireAdminPageAccess } from '@/lib/server/admin-session';

export default async function ClientPage() {
  await requireAdminPageAccess('/client');

  return <ClientWorkspace />;
}
