import { NextRequest, NextResponse } from 'next/server';

import { jsonError } from '@/lib/server/api-response';
import {
  archiveStory,
  getStory,
  publishStory,
  syncStoryMembership,
  updateStory,
} from '@/lib/server/admin-bff';
import { BackendApiError, getAdminAuthTokenFromRequest } from '@/lib/server/backend-api';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ storyId: string }> },
) {
  try {
    const authToken = getAdminAuthTokenFromRequest(request);
    const payload = (await request.json()) as {
      name: string;
      group_id: string;
      position: number;
      media_type: 'image' | 'video';
      asset_id: string;
      poster_asset_id: string | null;
      image_duration_ms: number | null;
      cta: {
        label: string;
        type: 'url' | 'deeplink';
        value: string;
      } | null;
    };
    const { storyId } = await context.params;
    const existingStory = await getStory(storyId, authToken);
    const membershipChanged =
      existingStory.groupId !== payload.group_id || existingStory.position !== payload.position;

    if (membershipChanged) {
      await syncStoryMembership(storyId, payload.group_id, payload.position, authToken);
    }

    await updateStory(
      storyId,
      {
        name: payload.name,
        media_type: payload.media_type,
        asset_id: payload.asset_id,
        poster_asset_id: payload.poster_asset_id,
        image_duration_ms: payload.image_duration_ms,
        cta: payload.cta,
      },
      authToken,
    );

    return NextResponse.json(await getStory(storyId, authToken));
  } catch (error) {
    if (error instanceof BackendApiError) {
      return jsonError(error.message, error.status, error.code ?? 'validation_error');
    }

    return jsonError('Story güncellenemedi.', 500, 'validation_error');
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ storyId: string }> },
) {
  try {
    const payload = (await request.json()) as { action?: string };
    const { storyId } = await context.params;
    const authToken = getAdminAuthTokenFromRequest(request);

    if (payload.action === 'archive') {
      return NextResponse.json(await archiveStory(storyId, true, authToken));
    }

    if (payload.action === 'restore') {
      return NextResponse.json(await archiveStory(storyId, false, authToken));
    }

    if (payload.action === 'publish') {
      return NextResponse.json(await publishStory(storyId, {}, authToken));
    }

    return jsonError('Geçersiz Story aksiyonu.', 400, 'validation_error');
  } catch (error) {
    if (error instanceof BackendApiError) {
      return jsonError(error.message, error.status, error.code ?? 'validation_error');
    }

    return jsonError('Story aksiyonu uygulanamadı.', 500, 'validation_error');
  }
}

export async function DELETE(
  _request: NextRequest,
  _context: { params: Promise<{ storyId: string }> },
) {
  return jsonError('Story hard delete v1 admin-web yüzeyinde desteklenmiyor.', 400, 'validation_error');
}
