import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const VALID_STATUSES = ['PENDING', 'IN_PROGRESS', 'VERIFIED', 'REJECTED'] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ message: 'Admin access required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { status } = body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 },
      );
    }

    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) {
      return NextResponse.json({ message: 'Company not found' }, { status: 404 });
    }

    const updated = await prisma.company.update({
      where: { id },
      data: { verificationStatus: status },
      include: {
        users: {
          select: { id: true, email: true, fullName: true, role: true },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[api/admin/companies/verification-status] Database error:', err);
    return NextResponse.json(
      { message: 'Failed to update verification status' },
      { status: 500 },
    );
  }
}
