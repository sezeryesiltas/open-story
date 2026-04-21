import { NextRequest, NextResponse } from 'next/server';

import { jsonError } from '@/lib/server/api-response';
import {
  archiveStoryGroup,
  mapStoryGroup,
  publishStoryGroup,
  syncStoryGroupSetReferences,
  updateStoryGroupRaw,
} from '@/lib/server/admin-bff';
import { BackendApiError, getAdminAuthTokenFromRequest } from '@/lib/server/backend-api';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ storyGroupId: string }> },
) {
  try {
    const authToken = getAdminAuthTokenFromRequest(request);
    const payload = (await request.json()) as {
      name: string;
      bottom_label: string | null;
      logo_asset_id: string;
      story_group_set_ids: string[];
      badge: {
        type: 'emoji' | 'svg';
        value: string;
      } | null;
    };
    const { storyGroupId } = await context.params;

    const storyGroup = await updateStoryGroupRaw(
      storyGroupId,
      {
        name: payload.name,
        bottom_label: payload.bottom_label,
        logo_asset_id: payload.logo_asset_id,
        badge: payload.badge,
      },
      authToken,
    );
    const storyGroupSets = await syncStoryGroupSetReferences(storyGroupId, payload.story_group_set_ids, authToken);

    return NextResponse.json(mapStoryGroup(storyGroup, storyGroupSets));
  } catch (error) {
    if (error instanceof BackendApiError) {
      return jsonError(error.message, error.status, error.code ?? 'validation_error');
    }

    return jsonError('Story Group güncellenemedi.', 500, 'validation_error');
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ storyGroupId: string }> },
) {
  try {
    const payload = (await request.json()) as { action?: string };
    const { storyGroupId } = await context.params;
    const authToken = getAdminAuthTokenFromRequest(request);

    if (payload.action === 'archive') {
      return NextResponse.json(await archiveStoryGroup(storyGroupId, true, authToken));
    }

    if (payload.action === 'restore') {
      return NextResponse.json(await archiveStoryGroup(storyGroupId, false, authToken));
    }

    if (payload.action === 'publish') {
      return NextResponse.json(await publishStoryGroup(storyGroupId, {}, authToken));
    }

    return jsonError('Geçersiz Story Group aksiyonu.', 400, 'validation_error');
  } catch (error) {
    if (error instanceof BackendApiError) {
      return jsonError(error.message, error.status, error.code ?? 'validation_error');
    }

    return jsonError('Story Group aksiyonu uygulanamadı.', 500, 'validation_error');
  }
}
