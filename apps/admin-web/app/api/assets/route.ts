import { NextRequest, NextResponse } from 'next/server';

import { jsonError } from '@/lib/server/api-response';
import { AssetStoreError, createUploadedAsset, createUrlAsset, listAssets } from '@/lib/server/asset-store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get('type');
    return NextResponse.json(listAssets(type === null ? undefined : (type as never)));
  } catch (error) {
    if (error instanceof AssetStoreError) {
      return jsonError(error.message, error.status, error.code);
    }

    return jsonError('Asset listesi okunamadı.', 500, 'validation_error');
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');

      if (!(file instanceof File)) {
        throw new AssetStoreError('Yüklenecek dosya zorunludur.', 400, 'validation_error');
      }

      const createdAsset = await createUploadedAsset({
        type: formData.get('type'),
        file,
        width: formData.get('width'),
        height: formData.get('height'),
      });

      return NextResponse.json(createdAsset, { status: 201 });
    }

    const payload = await request.json();
    return NextResponse.json(createUrlAsset(payload), { status: 201 });
  } catch (error) {
    if (error instanceof AssetStoreError) {
      return jsonError(error.message, error.status, error.code);
    }

    return jsonError('Asset oluşturulamadı.', 500, 'validation_error');
  }
}
