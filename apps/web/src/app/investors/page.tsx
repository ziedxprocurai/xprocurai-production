import type { Metadata } from 'next';
import { InvestorsContent } from './investors-content';

export const metadata: Metadata = {
  title: 'Investors',
  description:
    'Invest in xProcurAI — the AI-powered Supplier Intelligence Platform built to connect millions of buyers with qualified suppliers worldwide.',
  alternates: { canonical: '/investors' },
};

export default function InvestorsPage() {
  return <InvestorsContent />;
}
