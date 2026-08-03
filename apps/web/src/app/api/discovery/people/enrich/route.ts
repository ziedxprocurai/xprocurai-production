import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { matchApolloPerson } from '@/lib/apollo';
import { createPendingReveal } from '@/lib/phone-reveal-store';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { id, email, revealEmail, revealPhone } = body || {};

    if (!id && !email) {
      return NextResponse.json(
        { message: 'id or email is required to enrich a person' },
        { status: 400 },
      );
    }

    let phoneRevealToken: string | undefined;
    let webhookUrl: string | undefined;

    if (revealPhone) {
      phoneRevealToken = randomUUID();
      webhookUrl = `${env.APP_URL}/api/discovery/people/phone-webhook?token=${phoneRevealToken}`;
      createPendingReveal(phoneRevealToken);
    }

    const data = await matchApolloPerson({
      id: id || undefined,
      email: email || undefined,
      reveal_personal_emails: !!revealEmail,
      reveal_phone_number: !!revealPhone,
      webhook_url: webhookUrl,
    });

    return NextResponse.json({ ...data, phoneRevealToken: phoneRevealToken ?? null });
  } catch (err) {
    console.error('[api/discovery/people/enrich] Apollo request failed:', err);
    const message = err instanceof Error ? err.message : 'Failed to enrich person';
    const status = message.includes('APOLLO_API_KEY is not configured') ? 500 : 502;
    return NextResponse.json({ message }, { status });
  }
}
