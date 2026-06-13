import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { ReviewContent } from './review-content';

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  if (!(session as any).user?.onboarded) {
    redirect('/onboarding');
  }

  const { id } = await params;

  return (
    <DashboardLayout>
      <ReviewContent documentId={id} />
    </DashboardLayout>
  );
}
