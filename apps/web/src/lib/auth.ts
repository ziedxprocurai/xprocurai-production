import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

async function syncWithBackend(email: string, name: string, image: string) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
    const res = await fetch(`${apiUrl}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, fullName: name, avatarUrl: image }),
    });
    if (res.ok) return await res.json();
  } catch (error) {
    console.warn('[auth] Backend sync failed (API may be offline):', error);
  }
  return null;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    async signIn() {
      // Always allow Google sign-in; backend sync happens in jwt callback
      return true;
    },

    async jwt({ token, user, account, profile }) {
      // Initial sign in
      if (user && account) {
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;

        // Try to sync with backend
        const backendData = await syncWithBackend(
          user.email || '',
          user.name || '',
          user.image || '',
        );

        if (backendData) {
          token.accessToken = backendData.accessToken;
          token.refreshToken = backendData.refreshToken;
          token.backendUser = backendData.user;
          token.accessTokenExpires = Date.now() + 3600 * 1000;
        } else {
          token.accessTokenExpires = 0;
        }
      }

      // If no backend token yet, retry sync (with 30s cooldown to avoid flooding)
      if (!token.accessToken && token.email) {
        const lastRetry = (token.lastSyncRetry as number) || 0;
        if (Date.now() - lastRetry > 30000) {
          token.lastSyncRetry = Date.now();
          const backendData = await syncWithBackend(
            token.email as string,
            token.name as string || '',
            token.picture as string || '',
          );
          if (backendData) {
            token.accessToken = backendData.accessToken;
            token.refreshToken = backendData.refreshToken;
            token.backendUser = backendData.user;
            token.accessTokenExpires = Date.now() + 3600 * 1000;
          }
        }
      }

      // Refresh backend user data periodically (every 60s) to pick up onboarded flag changes
      if (token.accessToken && token.backendUser) {
        const lastUserRefresh = (token.lastUserRefresh as number) || 0;
        if (Date.now() - lastUserRefresh > 60000) {
          token.lastUserRefresh = Date.now();
          try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
            const meRes = await fetch(`${apiUrl}/auth/me`, {
              headers: { Authorization: `Bearer ${token.accessToken}` },
            });
            if (meRes.ok) {
              token.backendUser = await meRes.json();
            }
          } catch {
            // Silently ignore — will retry next time
          }
        }
      }

      // If we have a valid backend token, check expiry
      if (token.accessToken && Date.now() >= (token.accessTokenExpires as number)) {
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
          const res = await fetch(`${apiUrl}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: token.refreshToken }),
          });
          if (res.ok) {
            const data = await res.json();
            token.accessToken = data.accessToken;
            token.refreshToken = data.refreshToken;
            token.accessTokenExpires = Date.now() + 3600 * 1000;
          }
        } catch {
          console.warn('[auth] Token refresh failed');
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token.backendUser) {
        const bu = token.backendUser as any;
        session.user.id = bu.id;
        session.user.name = bu.fullName || token.name;
        session.user.image = bu.avatarUrl || token.picture;
        (session as any).user.role = bu.role;
        (session as any).user.onboarded = bu.onboarded;
      } else {
        // Backend not available — use Google profile data directly
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
        session.user.email = token.email as string;
        (session as any).user.onboarded = false;
      }

      // Always pass accessToken if available
      if (token.accessToken) {
        (session as any).accessToken = token.accessToken;
      }

      return session;
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) return url;
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      return baseUrl;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
});
