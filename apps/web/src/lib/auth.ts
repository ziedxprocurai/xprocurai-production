import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { prisma } from './prisma';
import { generateTokens, verifyRefreshToken } from './jwt';

async function syncUser(email: string, name: string, image: string) {
  try {
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          fullName: name,
          avatarUrl: image,
          authProvider: 'GOOGLE',
          isActive: true,
        },
      });
    } else {
      user = await prisma.user.update({
        where: { email },
        data: {
          fullName: name || user.fullName,
          avatarUrl: image || user.avatarUrl,
          authProvider: 'GOOGLE',
        },
      });
    }

    const tokens = await generateTokens(user.id, user.email, user.role, user.isAdmin);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        onboarded: user.onboarded,
        isAdmin: user.isAdmin,
      },
      ...tokens,
    };
  } catch (error) {
    console.error('[auth] User sync failed:', error);
    return null;
  }
}

async function refreshUserData(userId: string) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) return null;
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      onboarded: user.onboarded,
      isAdmin: user.isAdmin,
    };
  } catch {
    return null;
  }
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
      return true;
    },

    async jwt({ token, user, account }) {
      // Initial sign in
      if (user && account) {
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;

        const syncData = await syncUser(
          user.email || '',
          user.name || '',
          user.image || '',
        );

        if (syncData) {
          token.accessToken = syncData.accessToken;
          token.refreshToken = syncData.refreshToken;
          token.backendUser = syncData.user;
          token.accessTokenExpires = Date.now() + 3600 * 1000;
        } else {
          token.accessTokenExpires = 0;
        }
      }

      // If no token yet, retry sync (with 30s cooldown)
      if (!token.accessToken && token.email) {
        const lastRetry = (token.lastSyncRetry as number) || 0;
        if (Date.now() - lastRetry > 30000) {
          token.lastSyncRetry = Date.now();
          const syncData = await syncUser(
            token.email as string,
            (token.name as string) || '',
            (token.picture as string) || '',
          );
          if (syncData) {
            token.accessToken = syncData.accessToken;
            token.refreshToken = syncData.refreshToken;
            token.backendUser = syncData.user;
            token.accessTokenExpires = Date.now() + 3600 * 1000;
          }
        }
      }

      // Refresh user data periodically (every 60s)
      if (token.accessToken && token.backendUser) {
        const lastUserRefresh = (token.lastUserRefresh as number) || 0;
        if (Date.now() - lastUserRefresh > 60000) {
          token.lastUserRefresh = Date.now();
          const bu = token.backendUser as any;
          const freshUser = await refreshUserData(bu.id);
          if (freshUser) {
            token.backendUser = freshUser;
          }
        }
      }

      // If access token expired, regenerate tokens
      if (token.accessToken && Date.now() >= (token.accessTokenExpires as number)) {
        try {
          const payload = await verifyRefreshToken(token.refreshToken as string);
          if (payload) {
            const tokens = await generateTokens(payload.sub, payload.email, payload.role, payload.isAdmin);
            token.accessToken = tokens.accessToken;
            token.refreshToken = tokens.refreshToken;
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
        (session as any).user.isAdmin = bu.isAdmin || false;
      } else {
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
        session.user.email = token.email as string;
        (session as any).user.onboarded = false;
        (session as any).user.isAdmin = false;
      }

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
