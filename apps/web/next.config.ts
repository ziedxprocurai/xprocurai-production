import type { NextConfig } from 'next';

const isProduction = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@xprocurai/ui', '@xprocurai/types', '@xprocurai/config'],
  
  // Production optimizations
  ...(isProduction && {
    compress: true,
    poweredByHeader: false,
    generateEtags: true,
  }),

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },

  // Serverless optimization for Prisma
  serverExternalPackages: ['@prisma/client'],
};

export default nextConfig;
