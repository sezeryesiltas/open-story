import { DashboardDataVolume } from '@/components/admin/dashboard-data-volume';
import { PageHeader } from '@/components/admin/page-header';
import { BackendApiError, getAdminAuthTokenFromCookies } from '@/lib/server/backend-api';
import { loadDashboardDataVolumeSnapshot } from '@/lib/server/dashboard-data-volume';

async function loadDashboardDataVolume() {
  try {
    const authToken = await getAdminAuthTokenFromCookies();

    return {
      snapshot: await loadDashboardDataVolumeSnapshot(authToken),
      errorMessage: undefined,
    };
  } catch (error) {
    return {
      snapshot: null,
      errorMessage:
        error instanceof BackendApiError || error instanceof Error
          ? error.message
          : 'Aktif veri hacmi okunamadi.',
    };
  }
}

export default async function DashboardPage() {
  const { snapshot, errorMessage } = await loadDashboardDataVolume();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" />

      <DashboardDataVolume errorMessage={errorMessage} snapshot={snapshot} />
    </div>
  );
}
