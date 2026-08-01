import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { searchApolloCompanies } from '@/lib/apollo';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const data = await searchApolloCompanies(body);
    return NextResponse.json(data);
  } catch (err) {
    console.error('[api/discovery/companies] Apollo request failed:', err);
    const message = err instanceof Error ? err.message : 'Failed to search companies';
    const status = message.includes('APOLLO_API_KEY is not configured') ? 500 : 502;
    return NextResponse.json({ message }, { status });
  }
}
