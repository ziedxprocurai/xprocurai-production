import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { QUOTE_CURRENCIES } from '@/lib/rfq-constants';

export const runtime = 'nodejs';

const CURRENCY_VALUES = new Set<string>(QUOTE_CURRENCIES);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

// Buyer-side ownership is per-user; the supplierId branch keeps the
// onboarded-supplier "Received RFQs" inbox working.
function accessFilter(user: { id: string; company: { id: string } | null }) {
  return {
    OR: [
      { userId: user.id },
      ...(user.company ? [{ supplierId: user.company.id }] : []),
    ],
  };
}

function badRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  try {
    const rfq = await prisma.rFQ.findFirst({
      where: {
        id,
        ...accessFilter(user),
      },
      select: { quote: true },
    });

    if (!rfq) {
      return NextResponse.json({ message: 'RFQ not found' }, { status: 404 });
    }

    return NextResponse.json({ quote: rfq.quote ?? null });
  } catch (err) {
    console.error('[api/rfqs/[id]/quote] Database error:', err);
    return NextResponse.json(
      { message: 'Failed to fetch quote' },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await req.json();

    const rfq = await prisma.rFQ.findFirst({
      where: {
        id,
        ...accessFilter(user),
      },
      include: { supplier: { select: { legalName: true } } },
    });

    if (!rfq) {
      return NextResponse.json({ message: 'RFQ not found' }, { status: 404 });
    }

    const supplierName =
      (typeof body.supplierName === 'string' ? body.supplierName.trim() : '') ||
      rfq.externalCompanyName ||
      rfq.supplier?.legalName ||
      '';
    if (!supplierName) {
      return badRequest('supplierName is required');
    }
    if (supplierName.length > 200) {
      return badRequest('supplierName must be at most 200 characters');
    }

    const unitPrice = Number(body.unitPrice);
    const totalPrice = Number(body.totalPrice);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return badRequest('unitPrice must be a non-negative number');
    }
    if (!Number.isFinite(totalPrice) || totalPrice < 0) {
      return badRequest('totalPrice must be a non-negative number');
    }

    if (typeof body.currency !== 'string' || !CURRENCY_VALUES.has(body.currency)) {
      return badRequest('currency must be one of: ' + QUOTE_CURRENCIES.join(', '));
    }

    const parseOptionalDays = (
      value: unknown,
      field: string,
    ): { value: number | null; error?: string } => {
      if (value === null || value === undefined || value === '') return { value: null };
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0 || n > 3650) {
        return { value: null, error: `${field} must be an integer between 0 and 3650` };
      }
      return { value: n };
    };
    const delivery = parseOptionalDays(body.deliveryTimeDays, 'deliveryTimeDays');
    if (delivery.error) return badRequest(delivery.error);
    const leadTime = parseOptionalDays(body.leadTimeDays, 'leadTimeDays');
    if (leadTime.error) return badRequest(leadTime.error);

    if (
      body.paymentTerms !== undefined &&
      body.paymentTerms !== null &&
      (typeof body.paymentTerms !== 'string' || body.paymentTerms.length > 500)
    ) {
      return badRequest('paymentTerms must be a string of at most 500 characters');
    }

    let certifications: string[] = [];
    if (body.certifications !== undefined && body.certifications !== null) {
      if (!Array.isArray(body.certifications)) {
        return badRequest('certifications must be an array of strings');
      }
      const seen = new Set<string>();
      for (const cert of body.certifications) {
        if (typeof cert !== 'string') {
          return badRequest('certifications must be an array of strings');
        }
        const trimmed = cert.trim();
        if (!trimmed) continue;
        if (trimmed.length > 100) {
          return badRequest('Each certification must be at most 100 characters');
        }
        const key = trimmed.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        certifications.push(trimmed);
      }
      if (certifications.length > 20) {
        return badRequest('certifications is limited to 20 entries');
      }
    }

    let validUntil: Date | null = null;
    if (body.validUntil !== undefined && body.validUntil !== null && body.validUntil !== '') {
      if (typeof body.validUntil !== 'string' || !DATE_RE.test(body.validUntil)) {
        return badRequest('validUntil must be a date in YYYY-MM-DD format');
      }
      const parsed = new Date(`${body.validUntil}T00:00:00.000Z`);
      if (Number.isNaN(parsed.getTime()) || body.validUntil !== parsed.toISOString().slice(0, 10)) {
        return badRequest('validUntil must be a valid date in YYYY-MM-DD format');
      }
      validUntil = parsed;
    }

    if (
      body.notes !== undefined &&
      body.notes !== null &&
      (typeof body.notes !== 'string' || body.notes.length > 5000)
    ) {
      return badRequest('notes must be a string of at most 5000 characters');
    }

    const quoteData = {
      supplierName,
      unitPrice,
      totalPrice,
      currency: body.currency,
      deliveryTimeDays: delivery.value,
      leadTimeDays: leadTime.value,
      paymentTerms:
        typeof body.paymentTerms === 'string' && body.paymentTerms.trim()
          ? body.paymentTerms.trim()
          : null,
      certifications,
      validUntil,
      notes: typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null,
    };

    const [, updated] = await prisma.$transaction([
      prisma.rFQQuote.upsert({
        where: { rfqId: rfq.id },
        create: { ...quoteData, rfqId: rfq.id, recordedById: user.id },
        update: { ...quoteData, recordedById: user.id },
      }),
      prisma.rFQ.update({
        where: { id: rfq.id },
        data:
          rfq.status === 'PENDING' || rfq.status === 'REVIEWED'
            ? { status: 'RESPONDED' }
            : {},
        include: RFQ_INCLUDE,
      }),
    ]);

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[api/rfqs/[id]/quote] Database error:', err);
    return NextResponse.json(
      { message: 'Failed to save quote' },
      { status: 500 },
    );
  }
}
