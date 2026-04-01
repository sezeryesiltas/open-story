import { NextRequest, NextResponse } from 'next/server';

import { jsonError } from '@/lib/server/api-response';
import { createStoryGroup, listStoryGroups, StoryGroupStoreError } from '@/lib/server/story-group-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(listStoryGroups());
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    return NextResponse.json(createStoryGroup(payload), { status: 201 });
  } catch (error) {
    if (error instanceof StoryGroupStoreError) {
      return jsonError(error.message, error.status, error.code);
    }

    return jsonError('Story Group oluşturulamadı.', 500, 'validation_error');
  }
}
