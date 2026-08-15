import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  if (!user.company) {
    return NextResponse.json(
      { message: 'User must belong to a company to create RFQs' },
      { status: 403 },
    );
  }

  try {
    const body = await req.json();
    const {
      title,
      description,
      quantity,
      supplierId,
      productId,
      // xDiscoveryBeta: RFQ targeting a not-yet-onboarded lead company.
      // The "send" itself is mocked (no real email/SMS is dispatched) but
      // we persist a full snapshot of the contact used so it shows up
      // alongside real RFQs in RFQ Management.
      isExternal,
      leadCompanyId,
      externalCompanyName,
      externalCompanyDomain,
      externalContactName,
      externalContactEmail,
      externalContactPhone,
      sentVia,
    } = body;

    if (!title) {
      return NextResponse.json({ message: 'Title is required' }, { status: 400 });
    }

    if (isExternal) {
      if (!externalCompanyName || (!externalContactEmail && !externalContactPhone)) {
        return NextResponse.json(
          { message: 'An external RFQ requires a company name and at least an email or phone contact' },
          { status: 400 },
        );
      }
    } else if (!supplierId) {
      return NextResponse.json({ message: 'supplierId is required' }, { status: 400 });
    }

    const rfq = await prisma.rFQ.create({
      data: {
        title,
        description: description || null,
        quantity: quantity || null,
        buyerId: user.company.id,
        supplierId: isExternal ? null : supplierId,
        productId: productId || null,
        isExternal: !!isExternal,
        leadCompanyId: isExternal ? leadCompanyId ?? null : null,
        externalCompanyName: isExternal ? externalCompanyName : null,
        externalCompanyDomain: isExternal ? externalCompanyDomain || null : null,
        externalContactName: isExternal ? externalContactName || null : null,
        externalContactEmail: isExternal ? externalContactEmail || null : null,
        externalContactPhone: isExternal ? externalContactPhone || null : null,
        sentVia: isExternal ? sentVia || (externalContactEmail ? 'EMAIL' : 'PHONE') : null,
      },
      include: {
        buyer: { select: { id: true, legalName: true } },
        supplier: { select: { id: true, legalName: true } },
        product: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(rfq);
  } catch (err) {
    console.error('[api/rfqs] Database error:', err);
    return NextResponse.json(
      { message: 'Failed to create RFQ' },
      { status: 500 },
    );
  }
}
