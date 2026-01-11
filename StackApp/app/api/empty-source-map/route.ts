import { NextResponse } from 'next/server';

// Empty source map to suppress 404 errors for missing SDK source maps
export async function GET() {
  return NextResponse.json(
    {
      version: 3,
      sources: [],
      mappings: '',
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}
