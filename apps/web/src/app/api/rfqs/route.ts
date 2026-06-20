import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  if (!user.company) {
    return NextResponse.json(
      { message: 'User must belong to a company to create RFQs' },
      { status: 403 },
    );
  }

  try {
    const body = await req.json();
    const { title, description, quantity, supplierId, productId } = body;

    if (!title || !supplierId) {
      return NextResponse.json(
        { message: 'Title and supplierId are required' },
        { status: 400 },
      );
    }

    const rfq = await prisma.rFQ.create({
      data: {
        title,
        description: description || null,
        quantity: quantity || null,
        buyerId: user.company.id,
        supplierId,
        productId: productId || null,
      },
      include: {
        buyer: { select: { id: true, legalName: true } },
        supplier: { select: { id: true, legalName: true } },
        product: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(rfq);
  } catch (err) {
    console.error('[api/rfqs] Database error:', err);
    return NextResponse.json(
      { message: 'Failed to create RFQ' },
      { status: 500 },
    );
  }
}
