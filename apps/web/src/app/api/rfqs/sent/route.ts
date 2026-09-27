import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  try {
    const rfqs = await prisma.rFQ.findMany({
      where: { userId: user.id },
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
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(rfqs);
  } catch (err) {
    console.error('[api/rfqs/sent] Database error:', err);
    return NextResponse.json(
      { message: 'Failed to fetch sent RFQs' },
      { status: 500 },
    );
  }
}
