import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  if (!user.company) {
    return NextResponse.json({ message: 'User must belong to a company.' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const document = await prisma.providerImportDocument.findFirst({
      where: { id, companyId: user.company.id },
      include: {
        records: { orderBy: { createdAt: 'asc' } },
        _count: { select: { records: true } },
      },
    });

    if (!document) {
      return NextResponse.json({ message: 'Document not found.' }, { status: 404 });
    }

    return NextResponse.json(document);
  } catch (err) {
    console.error('[api/provider-import/documents/[id] GET]', err);
    return NextResponse.json({ message: 'Failed to fetch document' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  if (!user.company) {
    return NextResponse.json({ message: 'User must belong to a company.' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const document = await prisma.providerImportDocument.findFirst({
      where: { id, companyId: user.company.id },
    });

    if (!document) {
      return NextResponse.json({ message: 'Document not found.' }, { status: 404 });
    }

    await prisma.providerImportDocument.delete({ where: { id } });

    return NextResponse.json({ message: 'Document deleted successfully.' });
  } catch (err) {
    console.error('[api/provider-import/documents/[id] DELETE]', err);
    return NextResponse.json({ message: 'Failed to delete document' }, { status: 500 });
  }
}
