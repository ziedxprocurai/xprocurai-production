import { type NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  try {
    const rfq = await prisma.rFQ.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!rfq) {
      return NextResponse.json({ message: 'RFQ not found' }, { status: 404 });
    }

    const messages = await prisma.rFQMessage.findMany({
      where: { rfqId: id, userId: user.id },
      include: {
        attachments: {
          select: {
            id: true,
            filename: true,
            mimeType: true,
            size: true,
            isInline: true,
            attachmentType: true,
          },
        },
      },
    });

    messages.sort((a, b) => {
      const ta = (a.sentAt ?? a.receivedAt ?? a.createdAt).getTime();
      const tb = (b.sentAt ?? b.receivedAt ?? b.createdAt).getTime();
      return ta - tb;
    });

    return NextResponse.json({ messages });
  } catch (err) {
    console.error('[api/rfqs/[id]/messages] Error:', err);
    return NextResponse.json(
      { message: 'Failed to fetch messages' },
      { status: 500 },
    );
  }
}
