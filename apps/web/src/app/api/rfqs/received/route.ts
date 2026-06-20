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
    const rfqs = await prisma.rFQ.findMany({
      where: { supplierId: user.company.id },
      include: {
        buyer: { select: { id: true, legalName: true } },
        supplier: { select: { id: true, legalName: true } },
        product: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(rfqs);
  } catch (err) {
    console.error('[api/rfqs/received] Database error:', err);
    return NextResponse.json(
      { message: 'Failed to fetch received RFQs' },
      { status: 500 },
    );
  }
}
