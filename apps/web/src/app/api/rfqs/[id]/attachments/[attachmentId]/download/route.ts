import { type NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { graphFetch, isGraphConfigured, mailboxPath } from '@/lib/graph/graph-client';

export const runtime = 'nodejs';
export const maxDuration = 26;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const { id, attachmentId } = await params;
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  try {
    const attachment = await prisma.rFQMessageAttachment.findFirst({
      where: {
        id: attachmentId,
        rfqId: id,
        userId: user.id,
        rfq: { userId: user.id },
      },
    });
    if (!attachment) {
      return NextResponse.json({ message: 'Attachment not found' }, { status: 404 });
    }
    if (attachment.attachmentType === 'reference') {
      return NextResponse.json(
        { message: 'Reference attachments cannot be downloaded' },
        { status: 422 },
      );
    }
    if (!isGraphConfigured()) {
      return NextResponse.json(
        { message: 'Email service is not configured (Microsoft Graph)' },
        { status: 503 },
      );
    }

    const res = await graphFetch(
      `${mailboxPath()}/messages/${encodeURIComponent(attachment.graphMessageId)}/attachments/${encodeURIComponent(attachment.graphAttachmentId)}/$value`,
    );

    const asciiName =
      attachment.filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_') ||
      'attachment';
    const headers: Record<string, string> = {
      'Content-Type': attachment.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    };
    // Graph's attachment `size` field includes metadata overhead — never send
    // it as Content-Length. Forward the real byte count when Graph reports it.
    const contentLength = res.headers.get('content-length');
    if (contentLength) {
      headers['Content-Length'] = contentLength;
    }

    return new Response(res.body, { status: 200, headers });
  } catch (err) {
    console.error('[api/rfqs/[id]/attachments/download] Error:', err);
    return NextResponse.json(
      { message: 'Failed to download attachment' },
      { status: 500 },
    );
  }
}
