import { NextResponse } from 'next/server';

// Liveness only (architecture sec. 5, 10): no backend call, no content, no customer data.
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(
    { status: 'ok', version: process.env.APP_VERSION?.trim() || 'dev' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
