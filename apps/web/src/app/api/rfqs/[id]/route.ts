import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  if (!user.company) {
    return NextResponse.json(
      { message: 'User must belong to a company' },
      { status: 403 },
    );
  }

  try {
    const body = await req.json();

    const rfq = await prisma.rFQ.findFirst({
      where: {
        id,
        OR: [
          { buyerId: user.company.id },
          { supplierId: user.company.id },
        ],
      },
    });

    if (!rfq) {
      return NextResponse.json({ message: 'RFQ not found' }, { status: 404 });
    }

    const updated = await prisma.rFQ.update({
      where: { id },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.response !== undefined && { response: body.response }),
      },
      include: {
        buyer: { select: { id: true, legalName: true } },
        supplier: { select: { id: true, legalName: true } },
        product: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[api/rfqs/[id]] Database error:', err);
    return NextResponse.json(
      { message: 'Failed to update RFQ' },
      { status: 500 },
    );
  }
}
