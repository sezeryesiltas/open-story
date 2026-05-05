import { UsersWorkspace } from '@/components/admin/users-workspace';
import { requireAdminPageAccess } from '@/lib/server/admin-session';

export default async function UsersPage() {
  const session = await requireAdminPageAccess('/users');

  return <UsersWorkspace currentUserId={session.user.id} />;
}
