import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { searchLeadPersons, LEADGEN_MAX_PAGE_SIZE } from '@/lib/leadgen';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { keyword, jobTitle, companyName, city, region, country, hasEmail, page, pageSize } = body || {};

    const result = await searchLeadPersons(
      { keyword, jobTitle, companyName, city, region, country, hasEmail },
      page,
      Math.min(pageSize || LEADGEN_MAX_PAGE_SIZE, LEADGEN_MAX_PAGE_SIZE),
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error('[api/leadgen/people] Database error:', err);
    return NextResponse.json({ message: 'Failed to search people' }, { status: 500 });
  }
}
