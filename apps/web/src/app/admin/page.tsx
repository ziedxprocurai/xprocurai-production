import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function AdminPage() {
  const session = await auth();
  
  if (!session) {
    redirect('/auth/signin');
  }

  // Check if user is admin
  if (!(session as any).user?.isAdmin) {
    redirect('/dashboard');
  }

  // Redirect to Trust & Verification by default
  redirect('/admin/verification');
}
