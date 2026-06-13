import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { AdminSidebar } from './admin-sidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  
  if (!session) {
    redirect('/auth/signin');
  }

  // Check if user is admin
  if (!(session as any).user?.isAdmin) {
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-screen bg-[hsl(var(--background))]">
      <AdminSidebar />
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
