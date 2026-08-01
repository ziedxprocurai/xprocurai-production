import {
  Navbar,
  Hero,
  Trust,
  Stats,
  SupplierDiscovery,
  AIIntelligence,
  Onboarding,
  ERPIntegration,
  InvestorsTeaser,
  CTA,
  Footer,
} from '@/components/landing';

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="flex min-h-screen flex-col">
        <Hero />

        {/* Divider */}
        <div className="mx-auto h-px w-full max-w-5xl bg-gradient-to-r from-transparent via-[hsl(var(--border))]/60 to-transparent" />

        <Trust />

        <div className="mx-auto h-px w-full max-w-5xl bg-gradient-to-r from-transparent via-[hsl(var(--border))]/60 to-transparent" />

        <Stats />

        <div className="mx-auto h-px w-full max-w-5xl bg-gradient-to-r from-transparent via-[hsl(var(--border))]/60 to-transparent" />

        <SupplierDiscovery />

        <div className="mx-auto h-px w-full max-w-5xl bg-gradient-to-r from-transparent via-[hsl(var(--border))]/60 to-transparent" />

        <AIIntelligence />

        <div className="mx-auto h-px w-full max-w-5xl bg-gradient-to-r from-transparent via-[hsl(var(--border))]/60 to-transparent" />

        <Onboarding />

        <div className="mx-auto h-px w-full max-w-5xl bg-gradient-to-r from-transparent via-[hsl(var(--border))]/60 to-transparent" />

        <ERPIntegration />

        <InvestorsTeaser />

        <CTA />
      </main>
      <Footer />
    </>
  );
}
