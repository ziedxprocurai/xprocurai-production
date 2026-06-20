import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  if (!user.companyId) {
    return NextResponse.json(null, { status: 200 });
  }

  try {
    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      include: {
        users: {
          select: { id: true, email: true, fullName: true, role: true },
        },
      },
    });

    if (!company) {
      return NextResponse.json(null, { status: 200 });
    }

    return NextResponse.json(company);
  } catch (err) {
    console.error('[api/companies/me] Database error:', err);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 },
    );
  }
}
