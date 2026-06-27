import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  if (!(session as any).user?.onboarded) {
    redirect('/onboarding');
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}
