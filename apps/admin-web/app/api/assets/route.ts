import { NextRequest, NextResponse } from 'next/server';

import { jsonError } from '@/lib/server/api-response';
import { listAssets } from '@/lib/server/admin-bff';
import { BackendApiError, backendApiRequest, getAdminAuthTokenFromRequest } from '@/lib/server/backend-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get('type');
    const includeUsage = request.nextUrl.searchParams.get('include_usage');
    return NextResponse.json(
      await listAssets(type === null ? undefined : type, getAdminAuthTokenFromRequest(request), {
        includeUsage: includeUsage === null ? undefined : includeUsage !== 'false' && includeUsage !== '0',
      }),
    );
  } catch (error) {
    if (error instanceof BackendApiError) {
      return jsonError(error.message, error.status, error.code ?? 'validation_error');
    }

    return jsonError('Asset list could not be read.', 500, 'validation_error');
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const requestBody = request.body;
      if (!requestBody) {
        return jsonError('Upload request received an empty body.', 400, 'validation_error');
      }

      const uploadTarget =
        request.nextUrl.searchParams.get('storage') === 'cloud' ? '/v1/assets/cloud-upload' : '/v1/assets/upload';

      return NextResponse.json(
        await backendApiRequest(uploadTarget, {
          method: 'POST',
          authToken: getAdminAuthTokenFromRequest(request),
          body: requestBody,
          headers: {
            'Content-Type': contentType,
          },
          contentType: null,
          duplex: 'half',
        }),
        { status: 201 },
      );
    }

    if (contentType.includes('application/json')) {
      const body = await request.json().catch(() => null);

      return NextResponse.json(
        await backendApiRequest('/v1/assets/import', {
          method: 'POST',
          authToken: getAdminAuthTokenFromRequest(request),
          body: JSON.stringify(body),
        }),
        { status: 201 },
      );
    }

    return jsonError('Asset request must use multipart upload or JSON URL import format.', 400, 'validation_error');
  } catch (error) {
    if (error instanceof BackendApiError) {
      return jsonError(error.message, error.status, error.code ?? 'validation_error');
    }

    return jsonError('Asset could not be created.', 500, 'validation_error');
  }
}
