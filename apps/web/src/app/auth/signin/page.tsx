import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { SignInForm } from './sign-in-form';

export default async function SignInPage() {
  const session = await auth();
  if (session) {
    redirect('/onboarding');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))] px-6">
      <SignInForm />
    </div>
  );
}
