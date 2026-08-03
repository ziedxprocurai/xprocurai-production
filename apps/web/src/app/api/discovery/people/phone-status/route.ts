import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getPendingReveal } from '@/lib/phone-reveal-store';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ message: 'Missing token' }, { status: 400 });
  }

  const entry = getPendingReveal(token);
  if (!entry) {
    return NextResponse.json({ status: 'pending' });
  }

  return NextResponse.json(entry);
}
