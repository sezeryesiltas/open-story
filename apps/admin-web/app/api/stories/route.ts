import { NextRequest, NextResponse } from 'next/server';

import { jsonError } from '@/lib/server/api-response';
import {
  createStory,
  getStory,
  listStories,
  syncStoryMembership,
} from '@/lib/server/admin-bff';
import { BackendApiError, getAdminAuthTokenFromRequest } from '@/lib/server/backend-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await listStories(getAdminAuthTokenFromRequest(request)));
  } catch (error) {
    if (error instanceof BackendApiError) {
      return jsonError(error.message, error.status, error.code ?? 'validation_error');
    }

    return jsonError('Story list could not be read.', 500, 'validation_error');
  }
}

export async function POST(request: NextRequest) {
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

    const story = await createStory(
      {
        group_id: payload.group_id,
        name: payload.name,
        media_type: payload.media_type,
        asset_id: payload.asset_id,
        poster_asset_id: payload.poster_asset_id,
        image_duration_ms: payload.image_duration_ms,
        cta: payload.cta,
      },
      authToken,
    );
    await syncStoryMembership(story.id, payload.group_id, payload.position, authToken);

    return NextResponse.json(await getStory(story.id, authToken), { status: 201 });
  } catch (error) {
    if (error instanceof BackendApiError) {
      return jsonError(error.message, error.status, error.code ?? 'validation_error');
    }

    return jsonError('Story could not be created.', 500, 'validation_error');
  }
}
