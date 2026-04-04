import { NextRequest, NextResponse } from 'next/server';

import { jsonError } from '@/lib/server/api-response';
import {
  createStoryGroup,
  getStoryGroup,
  listStoryGroups,
  syncStoryGroupSetReferences,
} from '@/lib/server/admin-bff';
import { BackendApiError, getAdminAuthTokenFromRequest } from '@/lib/server/backend-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await listStoryGroups(getAdminAuthTokenFromRequest(request)));
  } catch (error) {
    if (error instanceof BackendApiError) {
      return jsonError(error.message, error.status, error.code ?? 'validation_error');
    }

    return jsonError('Story Group listesi okunamadı.', 500, 'validation_error');
  }
}

export async function POST(request: NextRequest) {
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

    const storyGroup = await createStoryGroup(
      {
        name: payload.name,
        bottom_label: payload.bottom_label,
        logo_asset_id: payload.logo_asset_id,
        story_ids: [],
        badge: payload.badge,
      },
      authToken,
    );

    await syncStoryGroupSetReferences(storyGroup.id, payload.story_group_set_ids, authToken);
    return NextResponse.json(await getStoryGroup(storyGroup.id, authToken), { status: 201 });
  } catch (error) {
    if (error instanceof BackendApiError) {
      return jsonError(error.message, error.status, error.code ?? 'validation_error');
    }

    return jsonError('Story Group oluşturulamadı.', 500, 'validation_error');
  }
}
