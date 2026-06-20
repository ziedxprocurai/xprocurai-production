export const siteConfig = {
  name: 'xProcurAI',
  description: 'B2B SaaS Procurement Intelligence Platform',
  url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  ogImage: '',
  links: {
    github: '',
    docs: '/docs',
  },
  creator: 'xProcurAI Team',
} as const;
