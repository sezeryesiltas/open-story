import { NextRequest, NextResponse } from 'next/server';
import type { UpdateDatabaseSettingsDto } from '@open-story/contracts';

import { jsonError } from '@/lib/server/api-response';
import { BackendApiError, backendApiRequestFromRoute } from '@/lib/server/backend-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await backendApiRequestFromRoute(request, '/v1/settings/database'));
  } catch (error) {
    if (error instanceof BackendApiError) {
      return jsonError(error.message, error.status, error.code ?? 'validation_error');
    }

    return jsonError(
      error instanceof Error ? error.message : 'Database settings could not be read.',
      500,
      'validation_error',
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const payload = (await request.json()) as UpdateDatabaseSettingsDto;
    return NextResponse.json(
      await backendApiRequestFromRoute(request, '/v1/settings/database', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    );
  } catch (error) {
    if (error instanceof BackendApiError) {
      return jsonError(error.message, error.status, error.code ?? 'validation_error');
    }

    return jsonError(
      error instanceof Error ? error.message : 'Database settings could not be updated.',
      400,
      'validation_error',
    );
  }
}
