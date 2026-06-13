import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { ScraperContent } from './scraper-content';

export default async function ScraperPage() {
  const session = await auth();
  
  if (!session) {
    redirect('/auth/signin');
  }

  if (!(session as any).user?.isAdmin) {
    redirect('/dashboard');
  }

  return <ScraperContent />;
}
