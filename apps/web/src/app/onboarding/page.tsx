import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Hexagon } from 'lucide-react';
import { CompanyForm } from './company-form';

export default async function OnboardingPage() {
  const session = await auth();
  if (!session) {
    redirect('/auth/signin');
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] px-6 py-12">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--primary))]">
            <Hexagon className="h-6 w-6 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
            Welcome, {session.user?.name?.split(' ')[0] || 'there'}!
          </h1>
          <p className="mt-2 text-[hsl(var(--muted-foreground))]">
            Set up your company profile to get started with xProcurAI.
          </p>
        </div>

        {/* Company Form */}
        <CompanyForm />
      </div>
    </div>
  );
}
