import { NextRequest, NextResponse } from 'next/server';

import { jsonError } from '@/lib/server/api-response';
import {
  setStoryGroupArchiveState,
  setStoryGroupPublishState,
  StoryGroupStoreError,
  updateStoryGroup,
} from '@/lib/server/story-group-store';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ storyGroupId: string }> },
) {
  try {
    const payload = await request.json();
    const { storyGroupId } = await context.params;
    return NextResponse.json(updateStoryGroup(storyGroupId, payload));
  } catch (error) {
    if (error instanceof StoryGroupStoreError) {
      return jsonError(error.message, error.status, error.code);
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

    if (payload.action === 'archive') {
      return NextResponse.json(setStoryGroupArchiveState(storyGroupId, true));
    }

    if (payload.action === 'restore') {
      return NextResponse.json(setStoryGroupArchiveState(storyGroupId, false));
    }

    if (payload.action === 'publish') {
      return NextResponse.json(setStoryGroupPublishState(storyGroupId, true));
    }

    if (payload.action === 'unpublish') {
      return NextResponse.json(setStoryGroupPublishState(storyGroupId, false));
    }

    return jsonError('Geçersiz Story Group aksiyonu.', 400, 'validation_error');
  } catch (error) {
    if (error instanceof StoryGroupStoreError) {
      return jsonError(error.message, error.status, error.code);
    }

    return jsonError('Story Group aksiyonu uygulanamadı.', 500, 'validation_error');
  }
}
