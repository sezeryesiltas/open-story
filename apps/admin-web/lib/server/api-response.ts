import { NextResponse } from 'next/server';

export function jsonError(message: string, status: number, code: string) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { status },
  );
}
