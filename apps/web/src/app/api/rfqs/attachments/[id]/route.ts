import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import {
  createAttachmentDownloadUrl,
  SUPABASE_STORAGE_NOT_CONFIGURED_MESSAGE,
} from '@/lib/supabase-storage';

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

  if (!user.company) {
    return NextResponse.json(
      { message: 'User must belong to a company' },
      { status: 403 },
    );
  }

  try {
    const attachment = await prisma.rFQAttachment.findFirst({
      where: {
        id,
        rfq: {
          OR: [{ buyerId: user.company.id }, { supplierId: user.company.id }],
        },
      },
      select: { storagePath: true, fileName: true },
    });

    if (!attachment) {
      return NextResponse.json({ message: 'Attachment not found' }, { status: 404 });
    }

    const url = await createAttachmentDownloadUrl(attachment.storagePath, attachment.fileName);
    return NextResponse.redirect(url, 302);
  } catch (err) {
    if (err instanceof Error && err.message === SUPABASE_STORAGE_NOT_CONFIGURED_MESSAGE) {
      return NextResponse.json({ message: err.message }, { status: 503 });
    }
    console.error('[api/rfqs/attachments/[id]] Error:', err);
    return NextResponse.json(
      { message: 'Failed to download attachment' },
      { status: 500 },
    );
  }
}
