import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ProviderImportSettingsContent } from './settings-content';

export default async function ProviderImportSettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  if (!(session as any).user?.isAdmin) {
    redirect('/dashboard');
  }

  return <ProviderImportSettingsContent />;
}
