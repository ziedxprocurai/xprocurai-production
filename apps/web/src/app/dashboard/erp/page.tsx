import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ERPContent } from './erp-content';

export default async function ERPPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  if (!(session as any).user?.onboarded) {
    redirect('/onboarding');
  }

  return <ERPContent />;
}
