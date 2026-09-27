import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import {
  MAX_RFQ_ATTACHMENTS,
  RFQ_CATEGORIES,
  UNIT_OF_MEASURE_OPTIONS,
} from '@/lib/rfq-constants';

export const runtime = 'nodejs';

const CATEGORY_VALUES = new Set<string>(RFQ_CATEGORIES);
const UNIT_VALUES = new Set<string>(UNIT_OF_MEASURE_OPTIONS.map((o) => o.value));

const ATTACHMENT_SELECT = {
  id: true,
  fileName: true,
  fileSize: true,
  mimeType: true,
  createdAt: true,
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
      // Groups RFQs sent together to multiple companies in one action
      // (e.g. a multi-select xDiscoveryBeta "Request Quote") so they render
      // as a single card in RFQ Management. Optional / caller-generated.
      batchId,
      // RFQ quote-workflow fields (all optional — older callers such as the
      // Suppliers page do not send them).
      category,
      itemName,
      unitOfMeasure,
      attachments,
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

    if (category !== undefined && category !== null) {
      if (typeof category !== 'string' || !CATEGORY_VALUES.has(category)) {
        return NextResponse.json({ message: 'Invalid category' }, { status: 400 });
      }
    }

    const trimmedItemName = typeof itemName === 'string' ? itemName.trim() : '';
    if (itemName !== undefined && itemName !== null) {
      if (typeof itemName !== 'string' || trimmedItemName.length === 0 || trimmedItemName.length > 200) {
        return NextResponse.json(
          { message: 'itemName must be a non-empty string of at most 200 characters' },
          { status: 400 },
        );
      }
    }

    if (unitOfMeasure !== undefined && unitOfMeasure !== null) {
      if (typeof unitOfMeasure !== 'string' || !UNIT_VALUES.has(unitOfMeasure)) {
        return NextResponse.json({ message: 'Invalid unit of measure' }, { status: 400 });
      }
    }

    const attachmentCreates: {
      storagePath: string;
      fileName: string;
      fileSize: number;
      mimeType: string | null;
      uploadedById: string;
    }[] = [];
    if (attachments !== undefined && attachments !== null) {
      if (!Array.isArray(attachments) || attachments.length > MAX_RFQ_ATTACHMENTS) {
        return NextResponse.json(
          { message: `attachments must be an array of at most ${MAX_RFQ_ATTACHMENTS} items` },
          { status: 400 },
        );
      }
      const allowedPrefix = `${user.company.id}/`;
      for (const attachment of attachments) {
        if (
          typeof attachment?.path !== 'string' ||
          !attachment.path.startsWith(allowedPrefix)
        ) {
          return NextResponse.json(
            { message: 'Invalid attachment path' },
            { status: 400 },
          );
        }
        if (typeof attachment?.fileName !== 'string' || !attachment.fileName.trim()) {
          return NextResponse.json(
            { message: 'Attachment fileName is required' },
            { status: 400 },
          );
        }
        const fileSize = Number(attachment?.fileSize);
        if (!Number.isInteger(fileSize) || fileSize <= 0) {
          return NextResponse.json(
            { message: 'Attachment fileSize must be a positive integer' },
            { status: 400 },
          );
        }
        attachmentCreates.push({
          storagePath: attachment.path,
          fileName: attachment.fileName.trim().slice(0, 255),
          fileSize,
          mimeType:
            typeof attachment?.mimeType === 'string' && attachment.mimeType
              ? attachment.mimeType.slice(0, 255)
              : null,
          uploadedById: user.id,
        });
      }
    }

    const rfq = await prisma.rFQ.create({
      data: {
        title,
        description: description || null,
        category: category || null,
        itemName: trimmedItemName || null,
        quantity: quantity || null,
        unitOfMeasure: unitOfMeasure || null,
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
        batchId: batchId || null,
        ...(attachmentCreates.length > 0 && {
          attachments: { create: attachmentCreates },
        }),
      },
      include: {
        buyer: { select: { id: true, legalName: true } },
        supplier: { select: { id: true, legalName: true } },
        product: { select: { id: true, name: true } },
        attachments: { select: ATTACHMENT_SELECT },
        quote: true,
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
