import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  let accessToken: string | null = null;
  try {
    const syncRes = await fetch(`${apiUrl}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: session.user.email,
        fullName: session.user.name || '',
        avatarUrl: session.user.image || '',
      }),
    });
    if (syncRes.ok) {
      const data = await syncRes.json();
      accessToken = data.accessToken;
    }
  } catch (err) {
    console.error('[api/rfqs] Backend sync failed:', err);
  }

  if (!accessToken) {
    return NextResponse.json(
      { message: 'Failed to authenticate with backend API' },
      { status: 502 },
    );
  }

  try {
    const body = await req.json();
    const res = await fetch(`${apiUrl}/rfqs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(
        data || { message: 'Failed to create RFQ' },
        { status: res.status },
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[api/rfqs] Request failed:', err);
    return NextResponse.json(
      { message: 'Failed to connect to backend API' },
      { status: 502 },
    );
  }
}
