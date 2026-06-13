import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { VerificationContent } from './verification-content';

export default async function VerificationPage() {
  const session = await auth();
  
  if (!session) {
    redirect('/auth/signin');
  }

  if (!(session as any).user?.isAdmin) {
    redirect('/dashboard');
  }

  return <VerificationContent />;
}
