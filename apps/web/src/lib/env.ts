export const env = {
  APP_NAME: process.env.NEXT_PUBLIC_APP_NAME ?? 'xProcurAI',
  APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'),
} as const;
