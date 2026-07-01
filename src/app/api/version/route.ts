import { NextResponse } from 'next/server';

// BUILD_ID changes on every `next build` — embedded at build time
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? Date.now().toString();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export function GET() {
  return NextResponse.json(
    { v: BUILD_ID },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    }
  );
}
