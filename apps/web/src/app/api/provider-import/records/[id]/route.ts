import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
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
    const record = await prisma.providerImportRecord.findFirst({
      where: { id, companyId: user.company.id },
    });

    if (!record) {
      return NextResponse.json({ message: 'Record not found.' }, { status: 404 });
    }

    const body = await req.json();

    const updated = await prisma.providerImportRecord.update({
      where: { id },
      data: {
        ...(body.companyName !== undefined && { companyName: body.companyName }),
        ...(body.contactPerson !== undefined && { contactPerson: body.contactPerson }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.address !== undefined && { address: body.address }),
        ...(body.country !== undefined && { country: body.country }),
        ...(body.vatId !== undefined && { vatId: body.vatId }),
        ...(body.website !== undefined && { website: body.website }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.isSelected !== undefined && { isSelected: body.isSelected }),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[api/provider-import/records/[id] PATCH]', err);
    return NextResponse.json({ message: 'Failed to update record' }, { status: 500 });
  }
}
