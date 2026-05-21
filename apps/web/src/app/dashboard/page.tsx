import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { DashboardContent } from './dashboard-content';

export default async function DashboardPage() {
  const session = await auth();
  if (!session) {
    redirect('/auth/signin');
  }

  // If user hasn't completed onboarding, redirect there
  if (!(session as any).user?.onboarded) {
    redirect('/onboarding');
  }

  return <DashboardContent />;
}
