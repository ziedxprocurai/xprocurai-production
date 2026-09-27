import { prisma } from '../prisma';
import { extractRfqReferences } from '../rfq-reference';
import {
  GraphError,
  graphFetch,
  graphMailbox,
  isGraphConfigured,
  mailboxPath,
} from './graph-client';
import { htmlToText } from './rfq-mailer';

export type InboundMessageKind = 'REPLY' | 'AUTO_REPLY' | 'BOUNCE';

const BOUNCE_SUBJECT_RE =
  /^(undeliverable|non remis|delivery status notification|mail delivery failed)/i;
const AUTO_REPLY_SUBJECT_RE = /^(automatic reply|réponse automatique|out of office)/i;

/**
 * Pure classifier for inbound mail: BOUNCE > AUTO_REPLY > REPLY.
 * `headers` keys are expected lowercased; `contentType` is the message body's
 * Content-Type (or the Content-Type internetMessageHeader).
 */
export function classifyInboundMessage(input: {
  subject?: string | null;
  headers?: Record<string, string>;
  fromEmail?: string | null;
  contentType?: string | null;
}): InboundMessageKind {
  const subject = (input.subject || '').trim();
  const headers = input.headers || {};
  const localPart = (input.fromEmail || '').split('@')[0].toLowerCase();
  const contentType = (input.contentType ?? headers['content-type'] ?? '').toLowerCase();

  if (
    localPart === 'postmaster' ||
    localPart === 'mailer-daemon' ||
    BOUNCE_SUBJECT_RE.test(subject) ||
    'x-ms-exchange-message-is-ndr' in headers ||
    // Covers message/delivery-status and multipart/report; report-type=delivery-status
    contentType.includes('delivery-status')
  ) {
    return 'BOUNCE';
  }

  const autoSubmitted = headers['auto-submitted'];
  if (
    (autoSubmitted != null && autoSubmitted.trim().toLowerCase() !== 'no') ||
    'x-auto-response-suppress' in headers ||
    'x-autoreply' in headers ||
    'x-autorespond' in headers ||
    AUTO_REPLY_SUBJECT_RE.test(subject)
  ) {
    return 'AUTO_REPLY';
  }

  return 'REPLY';
}

interface GraphRecipient {
  emailAddress?: { address?: string; name?: string };
}

interface GraphInboundMessage {
  subject?: string;
  from?: GraphRecipient;
  sender?: GraphRecipient;
  toRecipients?: GraphRecipient[];
  ccRecipients?: GraphRecipient[];
  body?: { contentType?: string; content?: string };
  internetMessageHeaders?: { name?: string; value?: string }[];
  conversationId?: string;
  internetMessageId?: string;
  hasAttachments?: boolean;
  isRead?: boolean;
  receivedDateTime?: string;
  sentDateTime?: string;
}

interface GraphAttachmentMeta {
  id?: unknown;
  name?: unknown;
  contentType?: unknown;
  size?: unknown;
  isInline?: unknown;
  contentId?: unknown;
  '@odata.type'?: unknown;
}

function mapRecipients(list: GraphRecipient[] | undefined) {
  return (list || []).map((r) => ({
    name: r?.emailAddress?.name || null,
    address: r?.emailAddress?.address || null,
  }));
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: string }).code === 'P2002'
  );
}

/**
 * Idempotently ingest one mailbox message into the RFQ conversation thread.
 * Matching order: explicit RFQ reference (subject, then text body) →
 * conversationId → In-Reply-To/References headers. Sender address alone is
 * never used for matching.
 */
export async function processInboundMessage(graphMessageId: string): Promise<void> {
  if (!isGraphConfigured()) return;
  if (!graphMessageId) return;

  const existing = await prisma.rFQMessage.findUnique({
    where: { graphMessageId },
    select: { id: true },
  });
  if (existing) return;

  let msg: GraphInboundMessage;
  try {
    msg = await (
      await graphFetch(
        `${mailboxPath()}/messages/${encodeURIComponent(graphMessageId)}?$select=id,subject,from,sender,toRecipients,ccRecipients,receivedDateTime,sentDateTime,conversationId,internetMessageId,hasAttachments,body,internetMessageHeaders,isRead`,
      )
    ).json();
  } catch (err) {
    if (err instanceof GraphError && err.status === 404) return;
    throw err;
  }

  const msgText = await graphFetch(
    `${mailboxPath()}/messages/${encodeURIComponent(graphMessageId)}?$select=uniqueBody,body`,
    { headers: { Prefer: 'outlook.body-content-type="text"' } },
  )
    .then((r) => r.json())
    .catch(() => null);

  const mailbox = graphMailbox().toLowerCase();
  const fromAddress = (msg?.from?.emailAddress?.address ||
    msg?.sender?.emailAddress?.address ||
    '') as string;
  const fromEmail = fromAddress.toLowerCase();

  if (fromEmail && fromEmail === mailbox) return;

  const rawBodyText: string =
    msgText?.uniqueBody?.content || msgText?.body?.content ||
    (msg?.body?.content ? htmlToText(String(msg.body.content)) : '');
  const bodyHtml =
    msg?.body?.contentType === 'html' || msg?.body?.contentType === 'HTML'
      ? String(msg.body.content)
      : null;

  const headers: Record<string, string> = {};
  for (const h of msg?.internetMessageHeaders || []) {
    if (h?.name) headers[String(h.name).toLowerCase()] = String(h.value ?? '');
  }

  // --- Match an RFQ -------------------------------------------------------
  let matchedRfqId: string | null = null;
  let matchedBy: string | null = null;

  const references = [
    ...extractRfqReferences(msg?.subject || ''),
    ...extractRfqReferences(rawBodyText),
  ];
  const seenRefs = new Set<string>();
  for (const ref of references) {
    if (seenRefs.has(ref)) continue;
    seenRefs.add(ref);
    const rfq = await prisma.rFQ.findUnique({
      where: { reference: ref },
      select: { id: true },
    });
    if (rfq) {
      matchedRfqId = rfq.id;
      matchedBy = 'REFERENCE';
      break;
    }
  }

  if (!matchedRfqId && msg?.conversationId) {
    const candidates = new Set<string>();
    const rfqRows = await prisma.rFQ.findMany({
      where: { graphConversationId: msg.conversationId },
      select: { id: true },
    });
    rfqRows.forEach((r) => candidates.add(r.id));
    const msgRows = await prisma.rFQMessage.findMany({
      where: { conversationId: msg.conversationId },
      select: { rfqId: true },
    });
    msgRows.forEach((m) => candidates.add(m.rfqId));
    if (candidates.size === 1) {
      matchedRfqId = [...candidates][0];
      matchedBy = 'CONVERSATION';
    } else if (candidates.size > 1) {
      console.warn(
        `[rfq-inbound] ambiguous conversation ${msg.conversationId} for message ${graphMessageId} (${candidates.size} RFQs)`,
      );
      return;
    }
  }

  if (!matchedRfqId) {
    const headerIds = [headers['in-reply-to'], headers['references']]
      .filter((v): v is string => Boolean(v))
      .flatMap((v) => v.split(/\s+/))
      .filter(Boolean);
    if (headerIds.length > 0) {
      const candidates = new Set<string>();
      const rfqRows = await prisma.rFQ.findMany({
        where: { graphInternetMessageId: { in: headerIds } },
        select: { id: true },
      });
      rfqRows.forEach((r) => candidates.add(r.id));
      const msgRows = await prisma.rFQMessage.findMany({
        where: { internetMessageId: { in: headerIds } },
        select: { rfqId: true },
      });
      msgRows.forEach((m) => candidates.add(m.rfqId));
      if (candidates.size === 1) {
        matchedRfqId = [...candidates][0];
        matchedBy = 'IN_REPLY_TO';
      } else if (candidates.size > 1) {
        console.warn(
          `[rfq-inbound] ambiguous In-Reply-To/References for message ${graphMessageId} (${candidates.size} RFQs)`,
        );
        return;
      }
    }
  }

  if (!matchedRfqId) {
    console.warn(`[rfq-inbound] no RFQ match for message ${graphMessageId}`);
    return;
  }

  const rfq = await prisma.rFQ.findUnique({ where: { id: matchedRfqId } });
  if (!rfq) return;

  const kind = classifyInboundMessage({
    subject: msg?.subject,
    headers,
    fromEmail,
    contentType: msg?.body?.contentType,
  });

  // Attachment metadata is fetched before the transaction (one extra Graph
  // call) so the DB transaction itself stays short and side-effect free.
  let attachmentRows: {
    messageIdPlaceholder?: never;
    graphMessageId: string;
    graphAttachmentId: string;
    filename: string;
    mimeType: string | null;
    size: number;
    isInline: boolean;
    attachmentType: string;
    contentId: string | null;
  }[] = [];
  if (msg?.hasAttachments) {
    try {
      const atts = await (
        await graphFetch(
          `${mailboxPath()}/messages/${encodeURIComponent(graphMessageId)}/attachments?$select=id,name,contentType,size,isInline`,
        )
      ).json();
      attachmentRows = (atts?.value || []).map((a: GraphAttachmentMeta) => {
        const odataType = String(a?.['@odata.type'] || '');
        return {
          graphMessageId,
          graphAttachmentId: String(a.id),
          filename: String(a.name || 'attachment'),
          mimeType: a.contentType ? String(a.contentType) : null,
          size: Number(a.size) || 0,
          isInline: Boolean(a.isInline),
          attachmentType: odataType.includes('itemAttachment')
            ? 'item'
            : odataType.includes('referenceAttachment')
              ? 'reference'
              : 'file',
          contentId: a.contentId ? String(a.contentId) : null,
        };
      });
    } catch (err) {
      console.error(`[rfq-inbound] attachment list failed for ${graphMessageId}:`, err);
      attachmentRows = [];
    }
  }

  const receivedAt = msg?.receivedDateTime ? new Date(msg.receivedDateTime) : null;
  const supplierEmail = rfq.externalContactEmail?.toLowerCase() || null;

  try {
    await prisma.$transaction(async (tx) => {
      const message = await tx.rFQMessage.create({
        data: {
          rfqId: rfq.id,
          userId: rfq.userId,
          direction: 'INBOUND',
          kind,
          graphMessageId,
          internetMessageId: msg?.internetMessageId || null,
          conversationId: msg?.conversationId || null,
          inReplyTo: headers['in-reply-to'] || null,
          subject: msg?.subject || null,
          fromEmail: fromAddress || null,
          fromName: msg?.from?.emailAddress?.name || msg?.sender?.emailAddress?.name || null,
          toRecipients: mapRecipients(msg?.toRecipients),
          ccRecipients: mapRecipients(msg?.ccRecipients),
          bodyText: rawBodyText || null,
          bodyHtml,
          sentAt: msg?.sentDateTime ? new Date(msg.sentDateTime) : null,
          receivedAt,
          hasAttachments: Boolean(msg?.hasAttachments),
          matchedBy,
          senderMatchesSupplier: supplierEmail ? fromEmail === supplierEmail : null,
          graphMetadata: {
            isRead: Boolean(msg?.isRead),
            headers: {
              'Message-ID': headers['message-id'] ?? null,
              'In-Reply-To': headers['in-reply-to'] ?? null,
              References: headers['references'] ?? null,
              'Auto-Submitted': headers['auto-submitted'] ?? null,
            },
          },
        },
      });

      for (const att of attachmentRows) {
        await tx.rFQMessageAttachment.create({
          data: {
            messageId: message.id,
            rfqId: rfq.id,
            userId: rfq.userId,
            graphMessageId: att.graphMessageId,
            graphAttachmentId: att.graphAttachmentId,
            filename: att.filename,
            mimeType: att.mimeType,
            size: att.size,
            isInline: att.isInline,
            attachmentType: att.attachmentType,
            contentId: att.contentId,
          },
        });
      }

      const rfqUpdate: Record<string, unknown> = {};
      if (kind === 'REPLY') {
        rfqUpdate.emailStatus = 'REPLIED';
        rfqUpdate.lastReplyAt = receivedAt ?? new Date();
      } else if (kind === 'BOUNCE' && rfq.emailStatus !== 'REPLIED') {
        rfqUpdate.emailStatus = 'FAILED';
        rfqUpdate.emailError = 'Delivery failed (bounce received)';
      }
      if (Object.keys(rfqUpdate).length > 0) {
        await tx.rFQ.update({ where: { id: rfq.id }, data: rfqUpdate });
      }
    });
  } catch (err) {
    if (isUniqueViolation(err)) return; // already processed concurrently
    throw err;
  }
}
