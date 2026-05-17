import {
  Search,
  BrainCircuit,
  UserCheck,
  Plug,
  Globe,
  Filter,
  Star,
  TrendingUp,
  FileCheck,
  Users,
  Building2,
  ArrowLeftRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface FeatureDetail {
  icon: LucideIcon;
  text: string;
}

interface FeatureSectionProps {
  id?: string;
  badge: string;
  title: string;
  description: string;
  details: FeatureDetail[];
  icon: LucideIcon;
  reversed?: boolean;
}

function FeatureSection({
  id,
  badge,
  title,
  description,
  details,
  icon: SectionIcon,
  reversed = false,
}: FeatureSectionProps) {
  return (
    <section id={id} className="relative py-20 lg:py-28">
      <div
        className={`mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-2 lg:gap-20 ${
          reversed ? 'lg:direction-rtl' : ''
        }`}
      >
        {/* Text side */}
        <div className={reversed ? 'lg:order-2' : ''}>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))]/10 px-3.5 py-1 text-xs font-semibold tracking-wide text-[hsl(var(--primary))] uppercase">
            {badge}
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-[hsl(var(--foreground))] sm:text-4xl">
            {title}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-[hsl(var(--muted-foreground))]">
            {description}
          </p>
          <ul className="mt-8 space-y-4">
            {details.map((detail) => (
              <li key={detail.text} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10">
                  <detail.icon className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                </div>
                <span className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                  {detail.text}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Visual side */}
        <div className={reversed ? 'lg:order-1' : ''}>
          <div className="relative">
            <div className="rounded-2xl border border-[hsl(var(--border))]/50 bg-gradient-to-br from-[hsl(var(--muted))]/30 to-[hsl(var(--background))] p-8 sm:p-12">
              <div className="flex items-center justify-center">
                <div className="relative">
                  <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-[hsl(var(--primary))]/10 ring-1 ring-[hsl(var(--primary))]/20">
                    <SectionIcon className="h-12 w-12 text-[hsl(var(--primary))]" strokeWidth={1.5} />
                  </div>
                  {/* Decorative dots */}
                  <div className="absolute -top-3 -right-3 h-6 w-6 rounded-full bg-emerald-500/20" />
                  <div className="absolute -bottom-2 -left-2 h-4 w-4 rounded-full bg-amber-500/20" />
                </div>
              </div>
              {/* Mini feature cards */}
              <div className="mt-8 grid grid-cols-2 gap-3">
                {details.slice(0, 4).map((detail, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-[hsl(var(--border))]/30 bg-[hsl(var(--background))]/80 p-3 text-center"
                  >
                    <detail.icon className="mx-auto mb-1.5 h-4 w-4 text-[hsl(var(--primary))]/70" />
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {detail.text.split(' ').slice(0, 3).join(' ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            {/* Background glow */}
            <div className="pointer-events-none absolute inset-0 -z-10 translate-y-4 blur-3xl">
              <div className="mx-auto h-full w-3/4 rounded-full bg-[hsl(var(--primary))]/3" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SupplierDiscovery() {
  return (
    <FeatureSection
      id="features"
      badge="Supplier Discovery"
      title="Find the right suppliers — faster than ever"
      description="Search across a global supplier network using intelligent filters. Surface qualified vendors by industry, geography, certification, and capability — without manual research."
      icon={Search}
      details={[
        { icon: Globe, text: 'Global supplier database with real-time enrichment' },
        { icon: Filter, text: 'Advanced multi-criteria filtering and smart search' },
        { icon: Star, text: 'Supplier ratings, certifications, and compliance badges' },
        { icon: TrendingUp, text: 'Market intelligence and supplier risk scoring' },
      ]}
    />
  );
}

export function AIIntelligence() {
  return (
    <FeatureSection
      badge="AI-Powered Intelligence"
      title="Let AI do the heavy lifting"
      description="Our AI engine analyzes supplier data, identifies patterns, and delivers actionable recommendations so your procurement team can focus on strategic decisions instead of spreadsheets."
      icon={BrainCircuit}
      reversed
      details={[
        { icon: BrainCircuit, text: 'AI-powered supplier scoring and risk assessment' },
        { icon: TrendingUp, text: 'Predictive analytics for supply chain disruptions' },
        { icon: FileCheck, text: 'Automated compliance and document verification' },
        { icon: Star, text: 'Smart recommendations based on procurement history' },
      ]}
    />
  );
}

export function Onboarding() {
  return (
    <FeatureSection
      id="about"
      badge="Buyer & Supplier Onboarding"
      title="Onboard buyers and suppliers in minutes, not weeks"
      description="Streamline the entire onboarding lifecycle — from invitation and document collection to approval workflows. Configurable forms, automated reminders, and full audit trails."
      icon={UserCheck}
      details={[
        { icon: Users, text: 'Self-service registration portals for buyers and suppliers' },
        { icon: FileCheck, text: 'Configurable document collection and verification' },
        { icon: UserCheck, text: 'Multi-step approval workflows with role-based access' },
        { icon: Building2, text: 'Organization profiles with hierarchy and contacts' },
      ]}
    />
  );
}

export function ERPIntegration() {
  return (
    <FeatureSection
      badge="ERP/SAP-Ready"
      title="Built for enterprise integration from day one"
      description="xProcurAI is designed with ERP and SAP integration in mind. Standardized data models, webhook-ready APIs, and export formats ensure a smooth path to your enterprise systems."
      icon={Plug}
      reversed
      details={[
        { icon: ArrowLeftRight, text: 'RESTful API with webhook event notifications' },
        { icon: Plug, text: 'Pre-built connectors for SAP, Oracle, and Microsoft Dynamics' },
        { icon: FileCheck, text: 'Standardized master data formats (CSV, XML, JSON)' },
        { icon: Building2, text: 'Enterprise SSO and directory sync (SAML, OIDC)' },
      ]}
    />
  );
}
