import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getBackendToken } from '@/lib/backend-token';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  if (!(session as any).user?.isAdmin) {
    return NextResponse.json({ message: 'Admin access required' }, { status: 403 });
  }

  const accessToken = await getBackendToken(
    session.user.email,
    session.user.name || '',
    session.user.image || '',
  );

  if (!accessToken) {
    return NextResponse.json({ message: 'Failed to authenticate with backend API' }, { status: 502 });
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  try {
    const res = await fetch(`${apiUrl}/admin/settings/provider-import`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(data || { message: 'Failed to fetch settings' }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[api/admin/provider-import-settings GET]', err);
    return NextResponse.json({ message: 'Failed to connect to backend API' }, { status: 502 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  if (!(session as any).user?.isAdmin) {
    return NextResponse.json({ message: 'Admin access required' }, { status: 403 });
  }

  const accessToken = await getBackendToken(
    session.user.email,
    session.user.name || '',
    session.user.image || '',
  );

  if (!accessToken) {
    return NextResponse.json({ message: 'Failed to authenticate with backend API' }, { status: 502 });
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  try {
    const body = await req.json();
    const res = await fetch(`${apiUrl}/admin/settings/provider-import`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(data || { message: 'Failed to update settings' }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[api/admin/provider-import-settings PUT]', err);
    return NextResponse.json({ message: 'Failed to connect to backend API' }, { status: 502 });
  }
}
