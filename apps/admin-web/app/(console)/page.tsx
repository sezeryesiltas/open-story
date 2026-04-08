import { Button } from '@open-story/ui/components/button';
import Link from 'next/link';
import { Database, Eye } from 'lucide-react';

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
      <PageHeader
        actions={
          <>
            <Button asChild>
              <Link href="/settings">
                <Database data-icon="inline-start" />
                DB Settings
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/preview">
                <Eye data-icon="inline-start" />
                Onizlemeyi ac
              </Link>
            </Button>
          </>
        }
        description="Icerik akisiniz, aktif veri hacmi ve sistem ayarlari tek bakista gorunsun."
        eyebrow="Admin Console"
        title="Yönetim paneli"
      />

      <DashboardDataVolume errorMessage={errorMessage} snapshot={snapshot} />
    </div>
  );
}
