/**
 * Helper to obtain a backend access token for the current session user.
 * Follows the same pattern used across all existing API route handlers.
 */
export async function getBackendToken(
  email: string,
  name: string,
  image: string,
): Promise<string | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
  try {
    const res = await fetch(`${apiUrl}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, fullName: name, avatarUrl: image }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.accessToken ?? null;
    }
  } catch {
    // caller handles null
  }
  return null;
}
