import { timingSafeEqual } from 'crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import {
  GRAPH_NOT_CONFIGURED_MESSAGE,
  isGraphConfigured,
} from '@/lib/graph/graph-client';
import {
  ensureInboxSubscription,
  syncRecentInbox,
  webhookConfigError,
} from '@/lib/graph/subscriptions';

export const runtime = 'nodejs';
export const maxDuration = 26;

function safeCompare(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (cronSecret && bearer && safeCompare(bearer, cronSecret)) {
    return true;
  }
  const user = await getAuthenticatedUser();
  return Boolean(user?.isAdmin);
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ message: 'Not authorized' }, { status: 401 });
  }

  if (!isGraphConfigured()) {
    return NextResponse.json({ message: GRAPH_NOT_CONFIGURED_MESSAGE }, { status: 503 });
  }
  const webhookError = webhookConfigError();
  if (webhookError) {
    return NextResponse.json({ message: webhookError }, { status: 503 });
  }

  try {
    const subscription = await ensureInboxSubscription();
    const { scanned, processed } = await syncRecentInbox();
    return NextResponse.json({
      subscription: {
        id: subscription.id,
        expirationDateTime: subscription.expirationDateTime,
      },
      synced: processed,
      scanned,
    });
  } catch (err) {
    console.error('[api/internal/graph/maintenance] Error:', err);
    return NextResponse.json(
      { message: 'Graph maintenance failed' },
      { status: 500 },
    );
  }
}
