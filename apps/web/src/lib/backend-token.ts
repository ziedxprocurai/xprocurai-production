/**
 * @deprecated This module is no longer used in production.
 * All API routes now use Prisma directly via `@/lib/prisma` and `@/lib/api-auth`.
 * This file is kept for reference only and will be removed in a future cleanup.
 */
export async function getBackendToken(
  _email: string,
  _name: string,
  _image: string,
): Promise<string | null> {
  console.warn('[backend-token] DEPRECATED: Use @/lib/api-auth instead.');
  return null;
}
