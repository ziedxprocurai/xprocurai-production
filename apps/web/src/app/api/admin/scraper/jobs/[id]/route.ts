import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ message: 'Admin access required' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const job = await prisma.scraperJob.findUnique({
      where: { id },
      include: {
        contacts: { orderBy: [{ score: 'desc' }, { createdAt: 'asc' }] },
        _count: { select: { contacts: true } },
      },
    });

    if (!job) {
      return NextResponse.json({ message: 'Scrape job not found.' }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (err) {
    console.error('[api/admin/scraper/jobs/[id] GET]', err);
    return NextResponse.json({ message: 'Failed to fetch scrape job' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ message: 'Admin access required' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const job = await prisma.scraperJob.findUnique({ where: { id } });
    if (!job) {
      return NextResponse.json({ message: 'Scrape job not found.' }, { status: 404 });
    }

    await prisma.scraperJob.delete({ where: { id } });

    return NextResponse.json({ message: 'Scrape job deleted successfully.' });
  } catch (err) {
    console.error('[api/admin/scraper/jobs/[id] DELETE]', err);
    return NextResponse.json({ message: 'Failed to delete scrape job' }, { status: 500 });
  }
}
