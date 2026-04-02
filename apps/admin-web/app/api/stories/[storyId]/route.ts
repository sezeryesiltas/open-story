import { NextRequest, NextResponse } from 'next/server';

import { jsonError } from '@/lib/server/api-response';
import {
  deleteStory,
  setStoryArchiveState,
  setStoryPublishState,
  StoryStoreError,
  updateStory,
} from '@/lib/server/story-store';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ storyId: string }> },
) {
  try {
    const payload = await request.json();
    const { storyId } = await context.params;
    return NextResponse.json(updateStory(storyId, payload));
  } catch (error) {
    if (error instanceof StoryStoreError) {
      return jsonError(error.message, error.status, error.code);
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

    if (payload.action === 'archive') {
      return NextResponse.json(setStoryArchiveState(storyId, true));
    }

    if (payload.action === 'restore') {
      return NextResponse.json(setStoryArchiveState(storyId, false));
    }

    if (payload.action === 'publish') {
      return NextResponse.json(setStoryPublishState(storyId, true));
    }

    if (payload.action === 'unpublish') {
      return NextResponse.json(setStoryPublishState(storyId, false));
    }

    return jsonError('Geçersiz Story aksiyonu.', 400, 'validation_error');
  } catch (error) {
    if (error instanceof StoryStoreError) {
      return jsonError(error.message, error.status, error.code);
    }

    return jsonError('Story aksiyonu uygulanamadı.', 500, 'validation_error');
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ storyId: string }> },
) {
  try {
    const { storyId } = await context.params;
    deleteStory(storyId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof StoryStoreError) {
      return jsonError(error.message, error.status, error.code);
    }

    return jsonError('Story silinemedi.', 500, 'validation_error');
  }
}
