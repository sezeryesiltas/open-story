import { NextRequest, NextResponse } from 'next/server';

import { jsonError } from '@/lib/server/api-response';
import {
  StoryGroupSetStoreError,
  createStoryGroupSet,
  listStoryGroupSets,
} from '@/lib/server/story-group-set-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(listStoryGroupSets());
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    return NextResponse.json(createStoryGroupSet(payload), { status: 201 });
  } catch (error) {
    if (error instanceof StoryGroupSetStoreError) {
      return jsonError(error.message, error.status, error.code);
    }

    return jsonError('Story Bar oluşturulamadı.', 500, 'validation_error');
  }
}
