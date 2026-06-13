import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { SuppliersContent } from './suppliers-content';

export default async function SuppliersPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  if (!(session as any).user?.onboarded) {
    redirect('/onboarding');
  }

  return (
    <DashboardLayout>
      <SuppliersContent />
    </DashboardLayout>
  );
}
