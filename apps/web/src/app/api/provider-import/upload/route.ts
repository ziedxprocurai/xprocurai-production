import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getBackendToken } from '@/lib/backend-token';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  const accessToken = await getBackendToken(
    session.user.email,
    session.user.name || '',
    session.user.image || '',
  );

  if (!accessToken) {
    return NextResponse.json(
      { message: 'Failed to authenticate with backend API' },
      { status: 502 },
    );
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  try {
    const formData = await req.formData();
    const res = await fetch(`${apiUrl}/provider-import/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(
        data || { message: 'Upload failed' },
        { status: res.status },
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[api/provider-import/upload]', err);
    return NextResponse.json(
      { message: 'Failed to connect to backend API' },
      { status: 502 },
    );
  }
}
