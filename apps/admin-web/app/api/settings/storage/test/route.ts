import { NextRequest, NextResponse } from 'next/server';
import type { TestAssetStorageSettingsDto } from '@open-story/contracts';

import { jsonError } from '@/lib/server/api-response';
import { BackendApiError, backendApiRequestFromRoute } from '@/lib/server/backend-api';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as TestAssetStorageSettingsDto;
    return NextResponse.json(
      await backendApiRequestFromRoute(request, '/v1/settings/storage/test', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    );
  } catch (error) {
    if (error instanceof BackendApiError) {
      return jsonError(error.message, error.status, error.code ?? 'validation_error');
    }

    return jsonError(
      error instanceof Error ? error.message : 'Storage bağlantısı test edilemedi.',
      400,
      'validation_error',
    );
  }
}
