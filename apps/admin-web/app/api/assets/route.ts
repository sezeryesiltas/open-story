import { NextRequest, NextResponse } from 'next/server';

import { jsonError } from '@/lib/server/api-response';
import { listAssets } from '@/lib/server/admin-bff';
import { BackendApiError, backendApiRequest, getAdminAuthTokenFromRequest } from '@/lib/server/backend-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get('type');
    return NextResponse.json(await listAssets(type === null ? undefined : type, getAdminAuthTokenFromRequest(request)));
  } catch (error) {
    if (error instanceof BackendApiError) {
      return jsonError(error.message, error.status, error.code ?? 'validation_error');
    }

    return jsonError('Asset listesi okunamadı.', 500, 'validation_error');
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const requestBody = request.body;
      if (!requestBody) {
        return jsonError('Upload isteği boş gövde ile geldi.', 400, 'validation_error');
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

    return jsonError('Asset isteği multipart upload veya JSON URL import formatında olmalıdır.', 400, 'validation_error');
  } catch (error) {
    if (error instanceof BackendApiError) {
      return jsonError(error.message, error.status, error.code ?? 'validation_error');
    }

    return jsonError('Asset oluşturulamadı.', 500, 'validation_error');
  }
}
