import { type NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { sendRfqEmail } from '@/lib/graph/rfq-mailer';

export const runtime = 'nodejs';
export const maxDuration = 26;

const STALE_QUEUED_MS = 5 * 60 * 1000;

const RFQ_INCLUDE = {
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
} as const;

export async function POST(
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
    });
    if (!rfq) {
      return NextResponse.json({ message: 'RFQ not found' }, { status: 404 });
    }

    const staleQueued =
      rfq.emailStatus === 'QUEUED' &&
      rfq.updatedAt.getTime() < Date.now() - STALE_QUEUED_MS;
    if (rfq.emailStatus !== 'FAILED' && !staleQueued) {
      return NextResponse.json(
        { message: 'This RFQ email cannot be (re)sent in its current state' },
        { status: 409 },
      );
    }
    if (!rfq.externalContactEmail) {
      return NextResponse.json(
        { message: 'This RFQ has no recipient email' },
        { status: 409 },
      );
    }

    await sendRfqEmail(rfq.id);

    const updated = await prisma.rFQ.findUnique({
      where: { id: rfq.id },
      include: RFQ_INCLUDE,
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[api/rfqs/[id]/send] Error:', err);
    return NextResponse.json(
      { message: 'Failed to send RFQ email' },
      { status: 500 },
    );
  }
}
