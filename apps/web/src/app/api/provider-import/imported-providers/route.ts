import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  if (!user.company) {
    return NextResponse.json([], { status: 200 });
  }

  try {
    const providers = await prisma.importedProvider.findMany({
      where: { companyId: user.company.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(providers);
  } catch (err) {
    console.error('[imported-providers] Error:', err);
    return NextResponse.json(
      { message: 'Failed to fetch imported providers' },
      { status: 500 },
    );
  }
}
