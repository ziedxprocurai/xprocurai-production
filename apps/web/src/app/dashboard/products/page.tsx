import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ProductsContent } from './products-content';

export default async function ProductsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  if (!(session as any).user?.onboarded) {
    redirect('/onboarding');
  }

  return <ProductsContent />;
}
