import { NextRequest, NextResponse } from 'next/server';

import { jsonError } from '@/lib/server/api-response';
import { StoryGroupSetStoreError, updateStoryGroupSet } from '@/lib/server/story-group-set-store';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ storyGroupSetId: string }> },
) {
  try {
    const payload = await request.json();
    const { storyGroupSetId } = await context.params;
    return NextResponse.json(updateStoryGroupSet(storyGroupSetId, payload));
  } catch (error) {
    if (error instanceof StoryGroupSetStoreError) {
      return jsonError(error.message, error.status, error.code);
    }

    return jsonError('Story Bar güncellenemedi.', 500, 'validation_error');
  }
}
