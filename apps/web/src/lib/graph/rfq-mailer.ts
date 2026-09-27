import { prisma } from '../prisma';
import { createAttachmentDownloadUrl, downloadAttachment } from '../supabase-storage';
import type { RfqRequestPayload } from '../rfq-payload';
import {
  GRAPH_NOT_CONFIGURED_MESSAGE,
  GraphError,
  graphFetch,
  graphMailbox,
  isGraphConfigured,
  mailboxPath,
} from './graph-client';
import { renderRfqEmail } from './rfq-email';

// sendMail request bodies are capped at ~4 MB after base64 encoding — keep
// the cumulative raw-byte budget under that and link the rest via Supabase.
const INLINE_ATTACHMENT_BUDGET = 2.8 * 1024 * 1024;
const LARGE_ATTACHMENT_LINK_SECONDS = 14 * 24 * 3600; // 14 days
const SENT_LOOKUP_ATTEMPTS = 3;
const SENT_LOOKUP_DELAY_MS = 1500;

export function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*(p|div|tr|table|li|ul|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function safeErrorMessage(err: unknown): string {
  if (err instanceof GraphError) {
    return `Graph ${err.status}${err.code ? ` ${err.code}` : ''}: ${err.message}`.slice(0, 500);
  }
  if (err instanceof Error) {
    return err.message.slice(0, 500);
  }
  return 'Unknown error';
}

async function markFailed(rfqId: string, message: string) {
  await prisma.rFQ.update({
    where: { id: rfqId },
    data: { emailStatus: 'FAILED', emailError: message },
  });
}

/**
 * Sends the RFQ email through the shared Microsoft 365 mailbox with a single
 * `sendMail` call (Mail.Send only — no draft round-trips, which would need
 * Mail.ReadWrite). Small attachments ride inline; larger ones become signed
 * Supabase download links inside the email body. Then records an OUTBOUND
 * RFQMessage. Never throws — returns { ok, error? } and flips the RFQ's
 * emailStatus to FAILED on error.
 */
export async function sendRfqEmail(rfqId: string): Promise<{ ok: boolean; error?: string }> {
  const rfq = await prisma.rFQ.findUnique({
    where: { id: rfqId },
    include: { attachments: true },
  });
  if (!rfq) {
    return { ok: false, error: 'RFQ not found' };
  }

  if (!isGraphConfigured()) {
    await markFailed(rfqId, GRAPH_NOT_CONFIGURED_MESSAGE);
    return { ok: false, error: GRAPH_NOT_CONFIGURED_MESSAGE };
  }

  try {
    if (!rfq.externalContactEmail) {
      throw new Error('RFQ has no recipient email');
    }
    if (!rfq.reference) {
      throw new Error('RFQ has no reference');
    }
    const payload = rfq.requestPayload as unknown as RfqRequestPayload | null;
    if (!payload || typeof payload !== 'object') {
      throw new Error('RFQ has no stored request payload');
    }

    await prisma.rFQ.update({
      where: { id: rfq.id },
      data: { emailStatus: 'QUEUED', emailAttempts: { increment: 1 } },
    });

    // Resolve attachments before rendering so the email body can list real
    // attachments and download links separately.
    const attachments: {
      '@odata.type': string;
      name: string;
      contentType: string;
      contentBytes: string;
    }[] = [];
    const attachmentLinks: { fileName: string; url: string }[] = [];
    let inlineBytes = 0;
    for (const attachment of rfq.attachments) {
      const bytes = await downloadAttachment(attachment.storagePath);
      if (inlineBytes + bytes.length <= INLINE_ATTACHMENT_BUDGET) {
        inlineBytes += bytes.length;
        attachments.push({
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: attachment.fileName,
          contentType: attachment.mimeType || 'application/octet-stream',
          contentBytes: bytes.toString('base64'),
        });
      } else {
        const url = await createAttachmentDownloadUrl(
          attachment.storagePath,
          attachment.fileName,
          LARGE_ATTACHMENT_LINK_SECONDS,
        );
        attachmentLinks.push({ fileName: attachment.fileName, url });
      }
    }

    const { subject, html } = renderRfqEmail({
      reference: rfq.reference,
      payload,
      attachmentNames: attachments.map((a) => a.name),
      attachmentLinks,
    });

    // sendMail (Mail.Send) — the reference also rides as an internet header
    // so replies keep it even if the supplier edits the subject line.
    const sendStartedAt = Date.now();
    await graphFetch(`${mailboxPath()}/sendMail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'HTML', content: html },
          toRecipients: [
            {
              emailAddress: {
                address: rfq.externalContactEmail,
                name: rfq.externalContactName || rfq.externalCompanyName || undefined,
              },
            },
          ],
          internetMessageHeaders: [
            { name: 'X-XprocurAi-RFQ-Reference', value: rfq.reference },
          ],
          attachments,
        },
        saveToSentItems: true,
      }),
    });

    // sendMail returns no ids — best-effort lookup of the just-sent message
    // in Sent Items (Mail.Read) to capture conversation/internetMessageId.
    // Failures here must NOT flip the RFQ to FAILED: the email was sent.
    let found: {
      id?: string;
      subject?: string;
      conversationId?: string;
      internetMessageId?: string;
      sentDateTime?: string;
    } | null = null;
    const sentSince = new Date(sendStartedAt - 60_000).toISOString();
    for (let attempt = 0; attempt < SENT_LOOKUP_ATTEMPTS; attempt += 1) {
      try {
        const page = await (
          await graphFetch(
            `${mailboxPath()}/mailFolders('SentItems')/messages?$filter=${encodeURIComponent(
              `sentDateTime ge ${sentSince}`,
            )}&$orderby=sentDateTime desc&$top=25&$select=id,subject,conversationId,internetMessageId,sentDateTime`,
          )
        ).json();
        found =
          (page?.value || []).find(
            (m: { subject?: string }) =>
              typeof m?.subject === 'string' && m.subject.includes(`[${rfq.reference}]`),
          ) ?? null;
        if (found) break;
      } catch (err) {
        console.warn('[rfq-mailer] Sent Items lookup failed (non-fatal):', err);
        break;
      }
      if (attempt < SENT_LOOKUP_ATTEMPTS - 1) {
        await new Promise((resolve) => setTimeout(resolve, SENT_LOOKUP_DELAY_MS));
      }
    }

    const sentAt = found?.sentDateTime ? new Date(found.sentDateTime) : new Date();
    await prisma.rFQ.update({
      where: { id: rfq.id },
      data: {
        emailStatus: 'WAITING_REPLY',
        emailSentAt: sentAt,
        emailError: null,
        graphMessageId: found?.id ?? null,
        graphInternetMessageId: found?.internetMessageId ?? null,
        graphConversationId: found?.conversationId ?? null,
        sentVia: 'EMAIL',
      },
    });

    // The outbound-${rfq.id} fallback key keeps the message row stable across
    // retries even when the Sent Items lookup found nothing.
    const outboundKey = found?.id ?? `outbound-${rfq.id}`;
    const messageData = {
      rfqId: rfq.id,
      userId: rfq.userId,
      direction: 'OUTBOUND' as const,
      kind: 'RFQ_REQUEST' as const,
      internetMessageId: found?.internetMessageId ?? null,
      conversationId: found?.conversationId ?? null,
      subject,
      fromEmail: graphMailbox(),
      fromName: 'XprocurAi',
      toRecipients: [
        {
          address: rfq.externalContactEmail,
          name: rfq.externalContactName || rfq.externalCompanyName || null,
        },
      ],
      bodyHtml: html,
      bodyText: htmlToText(html),
      sentAt,
      hasAttachments: rfq.attachments.length > 0,
    };
    await prisma.rFQMessage.upsert({
      where: { graphMessageId: outboundKey },
      create: { ...messageData, graphMessageId: outboundKey },
      update: messageData,
    });

    return { ok: true };
  } catch (err) {
    const message = safeErrorMessage(err);
    try {
      await markFailed(rfqId, message);
    } catch (markErr) {
      console.error('[rfq-mailer] failed to mark RFQ FAILED:', markErr);
    }
    console.error('[rfq-mailer] send failed:', message);
    return { ok: false, error: message };
  }
}
