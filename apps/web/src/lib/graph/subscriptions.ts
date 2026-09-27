import { prisma } from '../prisma';
import { extractRfqReferences } from '../rfq-reference';
import { GraphError, graphEnv, graphFetch, graphMailbox, mailboxPath } from './graph-client';
import { processInboundMessage } from './rfq-inbound';

const SUBSCRIPTION_TTL_MINUTES = 4200; // under the 10080-minute Graph max for mail
const RENEW_THRESHOLD_MS = 48 * 3600 * 1000;
const SYNC_LOOKBACK_MS = 72 * 3600 * 1000;
const CONVERSATION_LOOKBACK_MS = 30 * 24 * 3600 * 1000;
const SYNC_MAX_MESSAGES = 200;
const SYNC_TIME_BUDGET_MS = 18 * 1000; // stay under the route's maxDuration

function inboxResource(): string {
  // Graph resource strings are NOT URL-encoded.
  return `users/${graphMailbox()}/mailFolders('Inbox')/messages`;
}

function notificationUrl(): string {
  return (
    graphEnv('MICROSOFT_WEBHOOK_URL') ||
    `${graphEnv('NEXT_PUBLIC_APP_URL')}/api/webhooks/microsoft-graph`
  );
}

/**
 * A subscription must only exist when its notifications will be accepted:
 * a weak/missing client state or a missing webhook URL means every
 * notification would be dropped on arrival.
 */
export function webhookConfigError(): string | null {
  const clientState = graphEnv('MICROSOFT_WEBHOOK_CLIENT_STATE');
  if (!clientState || clientState.length < 32) {
    return 'MICROSOFT_WEBHOOK_CLIENT_STATE is not configured';
  }
  if (!graphEnv('MICROSOFT_WEBHOOK_URL') && !graphEnv('NEXT_PUBLIC_APP_URL')) {
    return 'MICROSOFT_WEBHOOK_URL or NEXT_PUBLIC_APP_URL is not configured';
  }
  return null;
}

async function createSubscription() {
  const expirationDateTime = new Date(
    Date.now() + SUBSCRIPTION_TTL_MINUTES * 60 * 1000,
  ).toISOString();
  const created = await (
    await graphFetch('/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        changeType: 'created',
        notificationUrl: notificationUrl(),
        resource: inboxResource(),
        expirationDateTime,
        clientState: graphEnv('MICROSOFT_WEBHOOK_CLIENT_STATE'),
      }),
    })
  ).json();
  const row = await prisma.graphSubscription.upsert({
    where: { id: created.id },
    create: {
      id: created.id,
      resource: created.resource || inboxResource(),
      changeType: created.changeType || 'created',
      notificationUrl: created.notificationUrl || notificationUrl(),
      expirationDateTime: new Date(created.expirationDateTime || expirationDateTime),
    },
    update: {
      resource: created.resource || inboxResource(),
      changeType: created.changeType || 'created',
      notificationUrl: created.notificationUrl || notificationUrl(),
      expirationDateTime: new Date(created.expirationDateTime || expirationDateTime),
    },
  });
  return row;
}

/**
 * Ensures a live Graph change-notification subscription exists for the
 * shared mailbox Inbox: keeps healthy rows, renews ones expiring within
 * 48 h, and recreates any that Graph no longer knows (404).
 */
export async function ensureInboxSubscription() {
  const configError = webhookConfigError();
  if (configError) throw new Error(configError);
  const resource = inboxResource();
  const rows = await prisma.graphSubscription.findMany({ where: { resource } });

  let kept: { id: string; expirationDateTime: Date } | null = null;

  for (const row of rows) {
    const expiresIn = row.expirationDateTime.getTime() - Date.now();
    if (expiresIn > RENEW_THRESHOLD_MS) {
      // Healthy window — confirm Graph still knows it, otherwise recreate.
      try {
        await graphFetch(`/subscriptions/${encodeURIComponent(row.id)}`);
        kept = { id: row.id, expirationDateTime: row.expirationDateTime };
        continue;
      } catch (err) {
        if (err instanceof GraphError && err.status === 404) {
          await prisma.graphSubscription.delete({ where: { id: row.id } }).catch(() => {});
          continue;
        }
        throw err;
      }
    }

    // Expiring soon (or expired) — renew.
    try {
      const expirationDateTime = new Date(
        Date.now() + SUBSCRIPTION_TTL_MINUTES * 60 * 1000,
      ).toISOString();
      await graphFetch(`/subscriptions/${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expirationDateTime }),
      });
      const updated = await prisma.graphSubscription.update({
        where: { id: row.id },
        data: { expirationDateTime: new Date(expirationDateTime) },
      });
      kept = { id: updated.id, expirationDateTime: updated.expirationDateTime };
    } catch (err) {
      if (err instanceof GraphError && err.status === 404) {
        await prisma.graphSubscription.delete({ where: { id: row.id } }).catch(() => {});
        continue;
      }
      throw err;
    }
  }

  if (kept) {
    return { id: kept.id, expirationDateTime: kept.expirationDateTime };
  }
  const created = await createSubscription();
  return { id: created.id, expirationDateTime: created.expirationDateTime };
}

/**
 * Safety net for missed webhook notifications: scans the mailbox Inbox for
 * messages received in the last 72 h and processes any not already stored.
 * Bounded: only candidates that plausibly belong to an RFQ (a reference in
 * the subject or a known conversation) are fetched, and the loop stops once
 * the time budget is exhausted — the next scheduled run continues.
 */
export async function syncRecentInbox(): Promise<{ scanned: number; processed: number }> {
  const startedAt = Date.now();
  const since = new Date(startedAt - SYNC_LOOKBACK_MS);
  const conversationSince = new Date(startedAt - CONVERSATION_LOOKBACK_MS);

  // Dedup set: only messages stored inside the scan window.
  const known = new Set(
    (
      await prisma.rFQMessage.findMany({
        where: { createdAt: { gte: since } },
        select: { graphMessageId: true },
      })
    ).map((m) => m.graphMessageId),
  );

  // Conversations we already track: outbound RFQs sent in the last 30 days
  // plus conversations of any recently stored message.
  const conversationIds = new Set<string>();
  const sentRfqs = await prisma.rFQ.findMany({
    where: { emailSentAt: { gte: conversationSince }, graphConversationId: { not: null } },
    select: { graphConversationId: true },
  });
  for (const r of sentRfqs) conversationIds.add(r.graphConversationId!);
  const knownMessages = await prisma.rFQMessage.findMany({
    where: { createdAt: { gte: conversationSince }, conversationId: { not: null } },
    select: { conversationId: true },
  });
  for (const m of knownMessages) conversationIds.add(m.conversationId!);

  let url: string =
    `${mailboxPath()}/mailFolders('Inbox')/messages?$filter=${encodeURIComponent(
      `receivedDateTime ge ${since.toISOString()}`,
    )}&$select=id,subject,conversationId,receivedDateTime&$top=50&$orderby=receivedDateTime desc`;

  let scanned = 0;
  let processed = 0;
  while (url && scanned < SYNC_MAX_MESSAGES && Date.now() - startedAt < SYNC_TIME_BUDGET_MS) {
    const page = await (await graphFetch(url)).json();
    for (const item of page?.value || []) {
      if (Date.now() - startedAt >= SYNC_TIME_BUDGET_MS) break;
      if (!item?.id || known.has(item.id)) {
        scanned += 1;
        continue;
      }
      scanned += 1;
      // Cheap prefilter — unmatched mail is never stored, so skip anything
      // that neither names a reference nor belongs to a known conversation.
      const looksLikeRfq =
        extractRfqReferences(item.subject).length > 0 ||
        (typeof item.conversationId === 'string' && conversationIds.has(item.conversationId));
      if (!looksLikeRfq) continue;
      try {
        await processInboundMessage(item.id);
        processed += 1;
      } catch (err) {
        console.error('[graph-maintenance] inbound sync failed for message:', err);
      }
    }
    url = typeof page?.['@odata.nextLink'] === 'string' ? page['@odata.nextLink'] : '';
  }
  return { scanned, processed };
}
