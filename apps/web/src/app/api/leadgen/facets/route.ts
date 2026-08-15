import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getLeadCompanyFacets } from '@/lib/leadgen';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  try {
    const facets = await getLeadCompanyFacets();
    // Cached in-memory for 10 min server-side (see lib/leadgen.ts); also let
    // the browser cache this for a short window to cut repeat egress.
    return NextResponse.json(facets, { headers: { 'Cache-Control': 'private, max-age=120' } });
  } catch (err) {
    console.error('[api/leadgen/facets] Database error:', err);
    return NextResponse.json({ message: 'Failed to fetch filters' }, { status: 500 });
  }
}
