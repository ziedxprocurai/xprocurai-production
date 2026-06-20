import { NextRequest, NextResponse } from 'next/server';
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
    const products = await prisma.product.findMany({
      where: { companyId: user.company.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(products);
  } catch (err) {
    console.error('[api/products] Database error:', err);
    return NextResponse.json(
      { message: 'Failed to fetch products' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  if (!user.company) {
    return NextResponse.json(
      { message: 'User must belong to a company to create products' },
      { status: 403 },
    );
  }

  try {
    const body = await req.json();
    const { name, description, quantity, isAvailable, isVisible } = body;

    if (!name) {
      return NextResponse.json(
        { message: 'Product name is required' },
        { status: 400 },
      );
    }

    const product = await prisma.product.create({
      data: {
        name,
        description: description || null,
        quantity: quantity || 0,
        isAvailable: isAvailable ?? true,
        isVisible: isVisible ?? true,
        companyId: user.company.id,
      },
    });

    return NextResponse.json(product);
  } catch (err) {
    console.error('[api/products] Database error:', err);
    return NextResponse.json(
      { message: 'Failed to create product' },
      { status: 500 },
    );
  }
}
