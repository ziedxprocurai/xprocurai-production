import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ message: 'Admin access required' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const contact = await prisma.scrapedContact.findUnique({ where: { id } });
    if (!contact) {
      return NextResponse.json({ message: 'Contact not found.' }, { status: 404 });
    }

    const body = await req.json();
    const reviewStatus = body.reviewStatus;

    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(reviewStatus)) {
      return NextResponse.json({ message: 'Invalid reviewStatus.' }, { status: 400 });
    }

    const updated = await prisma.scrapedContact.update({
      where: { id },
      data: { reviewStatus },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[api/admin/scraper/contacts/[id] PATCH]', err);
    return NextResponse.json({ message: 'Failed to update contact' }, { status: 500 });
  }
}
