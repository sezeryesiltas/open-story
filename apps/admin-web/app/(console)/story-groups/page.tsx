import { StoryGroupsWorkspace } from '@/components/admin/story-groups-workspace';
import { requireAdminPageAccess } from '@/lib/server/admin-session';

export default async function StoryGroupsPage() {
  await requireAdminPageAccess('/story-groups');

  return <StoryGroupsWorkspace />;
}
