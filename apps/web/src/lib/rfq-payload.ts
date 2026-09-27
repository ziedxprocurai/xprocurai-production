import {
  INCOTERMS,
  MAX_RFQ_ATTACHMENTS,
  QUOTE_CURRENCIES,
  RFQ_CATEGORIES,
  UNIT_OF_MEASURE_OPTIONS,
  type RFQUnitOfMeasureValue,
} from './rfq-constants';

// The normalized RFQ request — single source of truth for both the database
// row (rfqs.request_payload JSONB) and the outbound email body.
export interface RfqRequestPayload {
  title: string;
  category: string | null;
  itemName: string | null;
  specifications: string | null;
  quantity: number | null;
  unitOfMeasure: RFQUnitOfMeasureValue | null;
  requiredDeliveryDate: string | null; // YYYY-MM-DD
  deliveryLocation: string | null;
  currency: string | null;
  targetBudget: number | null;
  incoterm: string | null;
  paymentTerms: string | null;
  additionalRequirements: string | null;
  attachments: {
    path: string;
    fileName: string;
    fileSize: number;
    mimeType: string | null;
  }[];
}

export type NormalizeRfqResult =
  | { ok: true; payload: RfqRequestPayload }
  | { ok: false; message: string };

const CATEGORY_VALUES = new Set<string>(RFQ_CATEGORIES);
const UNIT_VALUES = new Set<string>(UNIT_OF_MEASURE_OPTIONS.map((o) => o.value));
const CURRENCY_VALUES = new Set<string>(QUOTE_CURRENCIES);
const INCOTERM_VALUES = new Set<string>(INCOTERMS.map((i) => i.value));
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function optionalString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

/** Validates + normalizes the RFQ request body into an RfqRequestPayload. */
export function normalizeRfqRequestPayload(body: unknown, companyId: string): NormalizeRfqResult {
  const input = (body ?? {}) as Record<string, unknown>;

  const title = optionalString(input.title, 300);
  if (!title) {
    return { ok: false, message: 'Title is required' };
  }

  let category: string | null = null;
  if (input.category !== undefined && input.category !== null && input.category !== '') {
    if (typeof input.category !== 'string' || !CATEGORY_VALUES.has(input.category)) {
      return { ok: false, message: 'Invalid category' };
    }
    category = input.category;
  }

  const itemName = optionalString(input.itemName, 200);
  if (input.itemName !== undefined && input.itemName !== null && input.itemName !== '' && !itemName) {
    return { ok: false, message: 'itemName must be a non-empty string of at most 200 characters' };
  }

  let unitOfMeasure: RFQUnitOfMeasureValue | null = null;
  if (input.unitOfMeasure !== undefined && input.unitOfMeasure !== null && input.unitOfMeasure !== '') {
    if (
      typeof input.unitOfMeasure !== 'string' ||
      !UNIT_VALUES.has(input.unitOfMeasure)
    ) {
      return { ok: false, message: 'Invalid unit of measure' };
    }
    unitOfMeasure = input.unitOfMeasure as RFQUnitOfMeasureValue;
  }

  let quantity: number | null = null;
  if (input.quantity !== undefined && input.quantity !== null && input.quantity !== '') {
    const n = Number(input.quantity);
    if (!Number.isInteger(n) || n <= 0) {
      return { ok: false, message: 'quantity must be a positive integer' };
    }
    quantity = n;
  }

  const specifications = optionalString(input.description, 20000);
  if (
    input.description !== undefined &&
    input.description !== null &&
    input.description !== '' &&
    !specifications
  ) {
    return { ok: false, message: 'description must be a string of at most 20000 characters' };
  }

  let requiredDeliveryDate: string | null = null;
  if (
    input.requiredDeliveryDate !== undefined &&
    input.requiredDeliveryDate !== null &&
    input.requiredDeliveryDate !== ''
  ) {
    if (typeof input.requiredDeliveryDate !== 'string' || !DATE_RE.test(input.requiredDeliveryDate)) {
      return { ok: false, message: 'requiredDeliveryDate must be a date in YYYY-MM-DD format' };
    }
    const parsed = new Date(`${input.requiredDeliveryDate}T00:00:00.000Z`);
    if (
      Number.isNaN(parsed.getTime()) ||
      input.requiredDeliveryDate !== parsed.toISOString().slice(0, 10)
    ) {
      return { ok: false, message: 'requiredDeliveryDate must be a valid date in YYYY-MM-DD format' };
    }
    const todayUtc = new Date().toISOString().slice(0, 10);
    if (input.requiredDeliveryDate < todayUtc) {
      return { ok: false, message: 'requiredDeliveryDate cannot be in the past' };
    }
    requiredDeliveryDate = input.requiredDeliveryDate;
  }

  const deliveryLocation = optionalString(input.deliveryLocation, 300);
  if (
    input.deliveryLocation !== undefined &&
    input.deliveryLocation !== null &&
    input.deliveryLocation !== '' &&
    !deliveryLocation
  ) {
    return { ok: false, message: 'deliveryLocation must be a string of at most 300 characters' };
  }

  let currency: string | null = null;
  if (input.currency !== undefined && input.currency !== null && input.currency !== '') {
    if (typeof input.currency !== 'string' || !CURRENCY_VALUES.has(input.currency)) {
      return { ok: false, message: `currency must be one of: ${QUOTE_CURRENCIES.join(', ')}` };
    }
    currency = input.currency;
  }

  let targetBudget: number | null = null;
  if (input.targetBudget !== undefined && input.targetBudget !== null && input.targetBudget !== '') {
    const n = Number(input.targetBudget);
    // FP-tolerant "at most two decimals" check (12345.67 * 100 is inexact).
    if (
      !Number.isFinite(n) ||
      n < 0 ||
      Math.abs(Math.round(n * 100) - n * 100) > 1e-6
    ) {
      return {
        ok: false,
        message: 'targetBudget must be a non-negative number with at most two decimal places',
      };
    }
    targetBudget = n;
  }

  let incoterm: string | null = null;
  if (input.incoterm !== undefined && input.incoterm !== null && input.incoterm !== '') {
    if (typeof input.incoterm !== 'string' || !INCOTERM_VALUES.has(input.incoterm)) {
      return { ok: false, message: 'Invalid incoterm' };
    }
    incoterm = input.incoterm;
  }

  const paymentTerms = optionalString(input.paymentTerms, 500);
  if (
    input.paymentTerms !== undefined &&
    input.paymentTerms !== null &&
    input.paymentTerms !== '' &&
    !paymentTerms
  ) {
    return { ok: false, message: 'paymentTerms must be a string of at most 500 characters' };
  }

  const additionalRequirements = optionalString(input.additionalRequirements, 5000);
  if (
    input.additionalRequirements !== undefined &&
    input.additionalRequirements !== null &&
    input.additionalRequirements !== '' &&
    !additionalRequirements
  ) {
    return {
      ok: false,
      message: 'additionalRequirements must be a string of at most 5000 characters',
    };
  }

  const attachments: RfqRequestPayload['attachments'] = [];
  if (input.attachments !== undefined && input.attachments !== null) {
    if (!Array.isArray(input.attachments) || input.attachments.length > MAX_RFQ_ATTACHMENTS) {
      return {
        ok: false,
        message: `attachments must be an array of at most ${MAX_RFQ_ATTACHMENTS} items`,
      };
    }
    const allowedPrefix = `${companyId}/`;
    for (const attachment of input.attachments as Record<string, unknown>[]) {
      if (
        typeof attachment?.path !== 'string' ||
        !attachment.path.startsWith(allowedPrefix)
      ) {
        return { ok: false, message: 'Invalid attachment path' };
      }
      if (typeof attachment?.fileName !== 'string' || !attachment.fileName.trim()) {
        return { ok: false, message: 'Attachment fileName is required' };
      }
      const fileSize = Number(attachment?.fileSize);
      if (!Number.isInteger(fileSize) || fileSize <= 0) {
        return { ok: false, message: 'Attachment fileSize must be a positive integer' };
      }
      attachments.push({
        path: attachment.path,
        fileName: attachment.fileName.trim().slice(0, 255),
        fileSize,
        mimeType:
          typeof attachment?.mimeType === 'string' && attachment.mimeType
            ? attachment.mimeType.slice(0, 255)
            : null,
      });
    }
  }

  return {
    ok: true,
    payload: {
      title,
      category,
      itemName,
      specifications,
      quantity,
      unitOfMeasure,
      requiredDeliveryDate,
      deliveryLocation,
      currency,
      targetBudget,
      incoterm,
      paymentTerms,
      additionalRequirements,
      attachments,
    },
  };
}
