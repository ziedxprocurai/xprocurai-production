import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ message: 'Not available' }, { status: 404 });
  }

  const session = await auth();
  
  return NextResponse.json({
    session,
    isAdmin: (session as any)?.user?.isAdmin,
    user: (session as any)?.user,
  });
}
