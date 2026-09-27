import { timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';
import { processInboundMessage } from '@/lib/graph/rfq-inbound';
import { graphEnv, isGraphConfigured } from '@/lib/graph/graph-client';

export const runtime = 'nodejs';

function safeCompare(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

// Public endpoint — Graph calls it for subscription validation (query param)
// and change notifications (body). Never return error details.
async function handle(req: NextRequest) {
  const validationToken = req.nextUrl.searchParams.get('validationToken');
  if (validationToken) {
    return new Response(validationToken, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const expectedClientState = graphEnv('MICROSOFT_WEBHOOK_CLIENT_STATE');

  try {
    const body = await req.json().catch(() => ({}));
    const notifications = Array.isArray(body?.value)
      ? (body.value as { clientState?: unknown; resourceData?: { id?: unknown } }[])
      : [];
    const valid = notifications.filter(
      (n) =>
        expectedClientState &&
        typeof n?.clientState === 'string' &&
        safeCompare(n.clientState, expectedClientState),
    );

    if (isGraphConfigured()) {
      // Sequential, fault-isolated: a bad message must not block the rest,
      // and Graph expects a fast (~3 s) response — stop after ~2.5 s and let
      // the scheduled inbox sweep pick up the remainder.
      const deadline = Date.now() + 2500;
      for (const notification of valid) {
        if (Date.now() >= deadline) break;
        const messageId = notification?.resourceData?.id;
        if (typeof messageId === 'string' && messageId) {
          try {
            await processInboundMessage(messageId);
          } catch (err) {
            console.error('[webhooks/microsoft-graph] inbound processing failed:', err);
          }
        }
      }
    }

    return new Response(null, { status: 202 });
  } catch (err) {
    console.error('[webhooks/microsoft-graph] error:', err);
    return new Response(null, { status: 202 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
