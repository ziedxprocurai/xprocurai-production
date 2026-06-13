import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getBackendToken } from '@/lib/backend-token';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
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
    const res = await fetch(`${apiUrl}/provider-import/documents/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(data || { message: 'Failed to fetch document' }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[api/provider-import/documents/[id] GET]', err);
    return NextResponse.json({ message: 'Failed to connect to backend API' }, { status: 502 });
  }
}

export async function DELETE(
  _req: NextRequest,
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
    const res = await fetch(`${apiUrl}/provider-import/documents/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(data || { message: 'Failed to delete document' }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[api/provider-import/documents/[id] DELETE]', err);
    return NextResponse.json({ message: 'Failed to connect to backend API' }, { status: 502 });
  }
}
