import { prisma } from '../prisma';
import { downloadAttachment } from '../supabase-storage';
import type { RfqRequestPayload } from '../rfq-payload';
import {
  GRAPH_NOT_CONFIGURED_MESSAGE,
  GraphError,
  graphFetch,
  isGraphConfigured,
  mailboxPath,
} from './graph-client';
import { renderRfqEmail } from './rfq-email';

const SMALL_ATTACHMENT_LIMIT = 3 * 1024 * 1024; // 3 MB — Graph inline attachment cap
const UPLOAD_CHUNK_BYTES = 3_276_800; // 3.125 MiB — multiple of 320 KiB as Graph requires

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
 * Sends the RFQ email through the shared Microsoft 365 mailbox:
 * creates a draft, pushes attachments, sends, then records an OUTBOUND
 * RFQMessage. Never throws — returns { ok, error? } and flips the RFQ's
 * emailStatus to FAILED on error (deleting the draft best-effort).
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

  let draftId: string | null = null;
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

    const { subject, html } = renderRfqEmail({
      reference: rfq.reference,
      payload,
      attachmentNames: rfq.attachments.map((a) => a.fileName),
    });

    const draft = await (
      await graphFetch(`${mailboxPath()}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        }),
      })
    ).json();
    draftId = draft.id;

    for (const attachment of rfq.attachments) {
      const bytes = await downloadAttachment(attachment.storagePath);
      if (bytes.length < SMALL_ATTACHMENT_LIMIT) {
        await graphFetch(`${mailboxPath()}/messages/${encodeURIComponent(draftId!)}/attachments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: attachment.fileName,
            contentType: attachment.mimeType || 'application/octet-stream',
            contentBytes: bytes.toString('base64'),
          }),
        });
      } else {
        const session = await (
          await graphFetch(
            `${mailboxPath()}/messages/${encodeURIComponent(draftId!)}/attachments/createUploadSession`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                AttachmentItem: {
                  attachmentType: 'file',
                  name: attachment.fileName,
                  size: bytes.length,
                  contentType: attachment.mimeType || 'application/octet-stream',
                },
              }),
            },
          )
        ).json();
        const uploadUrl = session.uploadUrl;
        for (let start = 0; start < bytes.length; start += UPLOAD_CHUNK_BYTES) {
          const end = Math.min(start + UPLOAD_CHUNK_BYTES, bytes.length) - 1;
          const chunk = bytes.subarray(start, end + 1);
          // DOM BodyInit rejects Buffer<ArrayBufferLike> — copy into a view
          // backed by a real ArrayBuffer.
          const body = new Uint8Array(new ArrayBuffer(chunk.byteLength));
          body.set(chunk);
          const res = await fetch(uploadUrl, {
            method: 'PUT',
            // No Authorization header — the upload session URL is pre-authenticated.
            headers: {
              'Content-Range': `bytes ${start}-${end}/${bytes.length}`,
              'Content-Length': String(body.length),
            },
            body,
          });
          if (!res.ok) {
            throw new Error(`Attachment upload failed for ${attachment.fileName} (${res.status})`);
          }
        }
      }
    }

    await graphFetch(`${mailboxPath()}/messages/${encodeURIComponent(draftId!)}/send`, { method: 'POST' });

    // ImmutableId survives the Drafts → Sent Items move; refresh best-effort.
    let sentMessage = draft;
    try {
      sentMessage = await (
        await graphFetch(
          `${mailboxPath()}/messages/${encodeURIComponent(draftId!)}?$select=id,conversationId,internetMessageId,sentDateTime`,
        )
      ).json();
    } catch {
      // message may already have moved — keep draft ids
    }

    const sentAt = sentMessage?.sentDateTime ? new Date(sentMessage.sentDateTime) : new Date();
    await prisma.rFQ.update({
      where: { id: rfq.id },
      data: {
        emailStatus: 'WAITING_REPLY',
        emailSentAt: sentAt,
        emailError: null,
        graphMessageId: sentMessage?.id || draftId,
        graphInternetMessageId:
          sentMessage?.internetMessageId || draft.internetMessageId || null,
        graphConversationId: sentMessage?.conversationId || draft.conversationId || null,
        sentVia: 'EMAIL',
      },
    });

    const messageData = {
      rfqId: rfq.id,
      userId: rfq.userId,
      direction: 'OUTBOUND' as const,
      kind: 'RFQ_REQUEST' as const,
      internetMessageId: sentMessage?.internetMessageId || draft.internetMessageId || null,
      conversationId: sentMessage?.conversationId || draft.conversationId || null,
      subject,
      fromEmail: process.env.MICROSOFT_MAILBOX!,
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
      where: { graphMessageId: sentMessage?.id || draftId! },
      create: { ...messageData, graphMessageId: sentMessage?.id || draftId! },
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
    if (draftId) {
      try {
        await graphFetch(`${mailboxPath()}/messages/${encodeURIComponent(draftId)}`, { method: 'DELETE' });
      } catch {
        // best-effort draft cleanup
      }
    }
    console.error('[rfq-mailer] send failed:', message);
    return { ok: false, error: message };
  }
}
