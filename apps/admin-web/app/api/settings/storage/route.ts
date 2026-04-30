import { NextRequest, NextResponse } from 'next/server';
import type { UpdateAssetStorageSettingsDto } from '@open-story/contracts';

import { jsonError } from '@/lib/server/api-response';
import { BackendApiError, backendApiRequestFromRoute } from '@/lib/server/backend-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await backendApiRequestFromRoute(request, '/v1/settings/storage'));
  } catch (error) {
    if (error instanceof BackendApiError) {
      return jsonError(error.message, error.status, error.code ?? 'validation_error');
    }

    return jsonError(
      error instanceof Error ? error.message : 'Storage ayarları okunamadı.',
      500,
      'validation_error',
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const payload = (await request.json()) as UpdateAssetStorageSettingsDto;
    return NextResponse.json(
      await backendApiRequestFromRoute(request, '/v1/settings/storage', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    );
  } catch (error) {
    if (error instanceof BackendApiError) {
      return jsonError(error.message, error.status, error.code ?? 'validation_error');
    }

    return jsonError(
      error instanceof Error ? error.message : 'Storage ayarları güncellenemedi.',
      400,
      'validation_error',
    );
  }
}
