import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { RFQsContent } from './rfqs-content';

export default async function RFQsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  if (!(session as any).user?.onboarded) {
    redirect('/onboarding');
  }

  return <RFQsContent />;
}
