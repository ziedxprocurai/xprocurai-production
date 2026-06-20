import { auth } from './auth';
import { prisma } from './prisma';

/**
 * Get the authenticated user from the session and resolve their database record.
 * Use this in Next.js API routes to get the current user with their company.
 */
export async function getAuthenticatedUser() {
  const session = await auth();
  if (!session?.user?.email) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { company: true },
  });

  if (!user || !user.isActive) {
    return null;
  }

  return user;
}

/**
 * Check if the authenticated user is an admin.
 */
export async function requireAdmin() {
  const user = await getAuthenticatedUser();
  if (!user || !user.isAdmin) {
    return null;
  }
  return user;
}
