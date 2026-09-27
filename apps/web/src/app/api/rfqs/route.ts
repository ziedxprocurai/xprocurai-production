import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { normalizeRfqRequestPayload } from '@/lib/rfq-payload';
import { generateRfqReference } from '@/lib/rfq-reference';
import { sendRfqEmail } from '@/lib/graph/rfq-mailer';

export const runtime = 'nodejs';
// Draft + attachment upload + send is several Graph round-trips.
export const maxDuration = 26;

const RFQ_INCLUDE = {
  buyer: { select: { id: true, legalName: true } },
  supplier: { select: { id: true, legalName: true } },
  product: { select: { id: true, name: true } },
  attachments: {
    select: {
      id: true,
      fileName: true,
      fileSize: true,
      mimeType: true,
      createdAt: true,
    },
  },
  quote: true,
  _count: { select: { messages: true } },
} as const;

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
      supplierId,
      productId,
      // xDiscoveryBeta: RFQ targeting a not-yet-onboarded lead company.
      // When an email address is on file, the RFQ is emailed through the
      // shared Microsoft 365 mailbox; a full snapshot of the contact used
      // is persisted so it shows up alongside real RFQs in RFQ Management.
      isExternal,
      leadCompanyId,
      externalCompanyName,
      externalCompanyDomain,
      externalContactName,
      externalContactEmail,
      externalContactPhone,
      sentVia,
      // Groups RFQs sent together to multiple companies in one action
      // (e.g. a multi-select xDiscoveryBeta "Request Quote") so they render
      // as a single card in RFQ Management. Optional / caller-generated.
      batchId,
    } = body;

    const normalized = normalizeRfqRequestPayload(body, user.company.id);
    if (!normalized.ok) {
      return NextResponse.json({ message: normalized.message }, { status: 400 });
    }
    const payload = normalized.payload;

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

    const createData = {
      title: payload.title,
      description: payload.specifications,
      category: payload.category,
      itemName: payload.itemName,
      quantity: payload.quantity,
      unitOfMeasure: payload.unitOfMeasure,
      buyerId: user.company.id,
      userId: user.id,
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
      batchId: batchId || null,
      requiredDeliveryDate: payload.requiredDeliveryDate
        ? new Date(`${payload.requiredDeliveryDate}T00:00:00.000Z`)
        : null,
      deliveryLocation: payload.deliveryLocation,
      currency: payload.currency,
      targetBudget: payload.targetBudget,
      incoterm: payload.incoterm,
      paymentTerms: payload.paymentTerms,
      additionalRequirements: payload.additionalRequirements,
      requestPayload: payload as unknown as Prisma.InputJsonValue,
      ...(payload.attachments.length > 0 && {
        attachments: {
          create: payload.attachments.map((a) => ({
            storagePath: a.path,
            fileName: a.fileName,
            fileSize: a.fileSize,
            mimeType: a.mimeType,
            uploadedById: user.id,
          })),
        },
      }),
    };

    // Retry on the (extremely unlikely) reference unique-collision.
    let rfq = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        rfq = await prisma.rFQ.create({
          data: { ...createData, reference: generateRfqReference() },
          include: RFQ_INCLUDE,
        });
        break;
      } catch (err) {
        const isReferenceCollision =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002' &&
          Array.isArray(err.meta?.target) &&
          (err.meta.target as string[]).includes('reference');
        if (!isReferenceCollision || attempt === 4) throw err;
      }
    }

    // External leads with an email on file are emailed through the shared
    // Microsoft 365 mailbox; phone-only leads keep emailStatus null.
    if (rfq!.isExternal && rfq!.externalContactEmail) {
      await sendRfqEmail(rfq!.id);
      rfq = await prisma.rFQ.findUnique({ where: { id: rfq!.id }, include: RFQ_INCLUDE });
    }

    return NextResponse.json(rfq);
  } catch (err) {
    console.error('[api/rfqs] Database error:', err);
    return NextResponse.json(
      { message: 'Failed to create RFQ' },
      { status: 500 },
    );
  }
}
