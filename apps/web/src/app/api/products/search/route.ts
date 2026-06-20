import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || '';

  try {
    const products = await prisma.product.findMany({
      where: {
        isVisible: true,
        isAvailable: true,
        ...(query && {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        company: { select: { id: true, legalName: true, country: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json(products);
  } catch (err) {
    console.error('[api/products/search] Database error:', err);
    return NextResponse.json(
      { message: 'Failed to search products' },
      { status: 500 },
    );
  }
}
