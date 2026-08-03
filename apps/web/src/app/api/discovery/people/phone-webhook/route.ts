import { NextRequest, NextResponse } from 'next/server';
import { resolvePendingReveal, failPendingReveal } from '@/lib/phone-reveal-store';

export const runtime = 'nodejs';

// Public endpoint - Apollo calls this asynchronously to deliver phone
// enrichment results. It is not user-authenticated; the unguessable `token`
// query param (minted per-request in /api/discovery/people/enrich) is what
// ties this delivery back to the correct pending reveal.
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ message: 'Missing token' }, { status: 400 });
  }

  try {
    const payload = await req.json();
    const person = payload?.people?.[0];

    if (payload?.status === 'success' && person?.phone_numbers?.length) {
      resolvePendingReveal(token, person.phone_numbers);
    } else {
      failPendingReveal(token, person?.status || payload?.status || 'No phone numbers found');
    }
  } catch (err) {
    console.error('[api/discovery/people/phone-webhook] Invalid payload:', err);
    failPendingReveal(token, 'Invalid webhook payload');
  }

  return NextResponse.json({ received: true });
}
