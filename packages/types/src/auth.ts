export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export type AuthProvider = 'LOCAL' | 'GOOGLE';

export type UserRole = 'ADMIN' | 'USER' | 'MANAGER';

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  authProvider: AuthProvider;
  role: UserRole;
  onboarded: boolean;
}

export interface GoogleLoginRequest {
  email: string;
  fullName: string;
  avatarUrl?: string;
}

export interface GoogleLoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}
