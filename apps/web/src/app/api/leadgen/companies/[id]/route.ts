import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getLeadCompanyDetail } from '@/lib/leadgen';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const companyId = Number(id);
  if (!Number.isInteger(companyId)) {
    return NextResponse.json({ message: 'Invalid company id' }, { status: 400 });
  }

  try {
    const company = await getLeadCompanyDetail(companyId);
    if (!company) {
      return NextResponse.json({ message: 'Company not found' }, { status: 404 });
    }
    return NextResponse.json(company);
  } catch (err) {
    console.error('[api/leadgen/companies/[id]] Database error:', err);
    return NextResponse.json({ message: 'Failed to fetch company' }, { status: 500 });
  }
}
