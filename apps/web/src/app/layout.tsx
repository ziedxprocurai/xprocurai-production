import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { SessionProvider } from '@/components/session-provider';
import { LanguageProvider } from '@/lib/i18n/language-context';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const siteUrl = 'https://xprocur.ai';
const title = 'xProcurAI — AI-Powered Supplier Intelligence Platform';
const description =
  'xProcurAI helps enterprises discover new suppliers, automate onboarding, and build intelligence-driven supply chains with AI — exposing your business to millions of qualified buyers worldwide.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: '%s | xProcurAI',
  },
  description,
  keywords: [
    'AI procurement',
    'supplier discovery',
    'supplier intelligence platform',
    'supplier onboarding',
    'ERP integration',
    'SAP integration',
    'B2B marketplace',
    'vendor management',
    'procurement software',
    'supply chain AI',
  ],
  authors: [{ name: 'xProcurAI' }],
  creator: 'xProcurAI',
  publisher: 'xProcurAI',
  applicationName: 'xProcurAI',
  category: 'technology',
  alternates: {
    canonical: siteUrl,
    languages: {
      en: `${siteUrl}`,
      fr: `${siteUrl}`,
      es: `${siteUrl}`,
      ar: `${siteUrl}`,
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    url: siteUrl,
    siteName: 'xProcurAI',
    title,
    description,
    locale: 'en_US',
    alternateLocale: ['fr_FR', 'es_ES', 'ar_SA'],
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'xProcurAI — AI-Powered Supplier Intelligence Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['/og-image.png'],
    creator: '@xprocurai',
  },
  icons: {
    icon: '/favicon.ico',
  },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'xProcurAI',
  url: siteUrl,
  description,
  email: 'contact@xprocur.ai',
  sameAs: [],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </head>
      <body className="min-h-screen antialiased">
        <SessionProvider>
          <ThemeProvider>
            <LanguageProvider>{children}</LanguageProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
