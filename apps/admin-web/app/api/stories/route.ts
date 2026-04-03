import { NextRequest, NextResponse } from 'next/server';

import { jsonError } from '@/lib/server/api-response';
import { createStory, listStories, StoryStoreError } from '@/lib/server/story-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(listStories());
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    return NextResponse.json(createStory(payload), { status: 201 });
  } catch (error) {
    if (error instanceof StoryStoreError) {
      return jsonError(error.message, error.status, error.code);
    }

    return jsonError('Story oluşturulamadı.', 500, 'validation_error');
  }
}
