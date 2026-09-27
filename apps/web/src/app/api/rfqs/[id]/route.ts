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

  try {
    const body = await req.json();

    // Buyer-side ownership is per-user; the supplierId branch keeps the
    // onboarded-supplier "Received RFQs" inbox working.
    const rfq = await prisma.rFQ.findFirst({
      where: {
        id,
        OR: [
          { userId: user.id },
          ...(user.company ? [{ supplierId: user.company.id }] : []),
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
        attachments: {
          select: {
            id: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
            createdAt: true,
          },
        },
        quote: true,
        _count: { select: { messages: true } },
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
