import { NextRequest, NextResponse } from 'next/server';
import { DbService } from '@open-story/db';

import { jsonError } from '@/lib/server/api-response';

const db = new DbService();

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(db.getDatabaseSettings());
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : 'Database ayarları okunamadı.',
      500,
      'validation_error',
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const payload = (await request.json()) as { externalDatabaseUrl?: string | null };
    return NextResponse.json(db.updateDatabaseSettings(payload.externalDatabaseUrl));
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : 'Database ayarları güncellenemedi.',
      400,
      'validation_error',
    );
  }
}
