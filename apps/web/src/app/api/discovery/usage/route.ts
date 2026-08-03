import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getApolloUsageStats } from '@/lib/apollo';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  try {
    const data = await getApolloUsageStats();
    return NextResponse.json({ available: true, ...data });
  } catch (err) {
    // The usage stats endpoint requires a Master API Key. Regular API keys
    // get a 401/403 here - treat that as "unavailable" rather than an error
    // so it doesn't break the Discovery page for most workspaces.
    console.warn('[api/discovery/usage] Apollo usage stats unavailable:', err);
    return NextResponse.json({ available: false });
  }
}
