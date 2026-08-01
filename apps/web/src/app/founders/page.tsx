import type { Metadata } from 'next';
import { FoundersContent } from './founders-content';

export const metadata: Metadata = {
  title: 'Founders',
  description:
    'Meet the founding team behind xProcurAI — engineers and procurement experts building the AI-powered Supplier Intelligence Platform.',
  alternates: { canonical: '/founders' },
};

export default function FoundersPage() {
  return <FoundersContent />;
}
