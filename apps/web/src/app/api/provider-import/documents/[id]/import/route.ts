import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getBackendToken } from '@/lib/backend-token';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;

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
    const res = await fetch(`${apiUrl}/provider-import/documents/${id}/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(data || { message: 'Import failed' }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[api/provider-import/documents/[id]/import POST]', err);
    return NextResponse.json({ message: 'Failed to connect to backend API' }, { status: 502 });
  }
}
