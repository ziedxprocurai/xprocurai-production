export const APP_NAME = 'xProcurAI';
export const APP_VERSION = '0.1.0';

export const API_DEFAULTS = {
  PORT: 4000,
  PREFIX: 'api',
  CORS_ORIGINS: 'http://localhost:3000',
} as const;

export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const JWT_DEFAULTS = {
  EXPIRATION: 3600,
  REFRESH_EXPIRATION: 604800,
} as const;

export const REDIS_DEFAULTS = {
  HOST: 'localhost',
  PORT: 6379,
} as const;

export const DATABASE_DEFAULTS = {
  HOST: 'localhost',
  PORT: 5432,
} as const;
