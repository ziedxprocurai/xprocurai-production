import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  if (!user.company) {
    return NextResponse.json({ message: 'User must belong to a company' }, { status: 403 });
  }

  try {
    const product = await prisma.product.findFirst({
      where: { id, companyId: user.company.id },
    });

    if (!product) {
      return NextResponse.json({ message: 'Product not found' }, { status: 404 });
    }

    const body = await req.json();
    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.quantity !== undefined && { quantity: body.quantity }),
        ...(body.isAvailable !== undefined && { isAvailable: body.isAvailable }),
        ...(body.isVisible !== undefined && { isVisible: body.isVisible }),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[api/products/[id]] Database error:', err);
    return NextResponse.json(
      { message: 'Failed to update product' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  if (!user.company) {
    return NextResponse.json({ message: 'User must belong to a company' }, { status: 403 });
  }

  try {
    const product = await prisma.product.findFirst({
      where: { id, companyId: user.company.id },
    });

    if (!product) {
      return NextResponse.json({ message: 'Product not found' }, { status: 404 });
    }

    await prisma.product.delete({ where: { id } });

    return NextResponse.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error('[api/products/[id]] Database error:', err);
    return NextResponse.json(
      { message: 'Failed to delete product' },
      { status: 500 },
    );
  }
}
