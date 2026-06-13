import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  // Check if user is admin
  if (!(session as any).user?.isAdmin) {
    return NextResponse.json({ message: 'Admin access required' }, { status: 403 });
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  // Get backend access token
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
    console.error('[api/admin/companies] Backend sync failed:', err);
  }

  if (!accessToken) {
    return NextResponse.json(
      { message: 'Failed to authenticate with backend API' },
      { status: 502 },
    );
  }

  // Fetch all companies
  try {
    const res = await fetch(`${apiUrl}/admin/companies`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(
        data || { message: 'Failed to fetch companies' },
        { status: res.status },
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[api/admin/companies] Request failed:', err);
    return NextResponse.json(
      { message: 'Failed to connect to backend API' },
      { status: 502 },
    );
  }
}
