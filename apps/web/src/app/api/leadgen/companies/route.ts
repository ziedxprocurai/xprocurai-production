import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { searchLeadCompanies, logLeadSearchQuery, LEADGEN_MAX_PAGE_SIZE } from '@/lib/leadgen';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      keyword,
      sectorLabel,
      city,
      region,
      country,
      sizeRange,
      source,
      hasEmail,
      hasPhone,
      hasLinkedin,
      page,
      pageSize,
    } = body || {};

    const result = await searchLeadCompanies(
      { keyword, sectorLabel, city, region, country, sizeRange, source, hasEmail, hasPhone, hasLinkedin },
      page,
      Math.min(pageSize || LEADGEN_MAX_PAGE_SIZE, LEADGEN_MAX_PAGE_SIZE),
    );

    // Fire-and-forget analytics log, never blocks or fails the request.
    logLeadSearchQuery(body, result.total, req.headers.get('x-forwarded-for'));

    return NextResponse.json(result);
  } catch (err) {
    console.error('[api/leadgen/companies] Database error:', err);
    return NextResponse.json({ message: 'Failed to search companies' }, { status: 500 });
  }
}
