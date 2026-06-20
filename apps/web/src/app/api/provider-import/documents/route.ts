import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  if (!user.company) {
    return NextResponse.json([], { status: 200 });
  }

  try {
    const documents = await prisma.providerImportDocument.findMany({
      where: { companyId: user.company.id },
      include: {
        _count: { select: { records: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(documents);
  } catch (err) {
    console.error('[api/provider-import/documents GET]', err);
    return NextResponse.json({ message: 'Failed to fetch documents' }, { status: 500 });
  }
}
