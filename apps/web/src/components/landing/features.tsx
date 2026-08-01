'use client';

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
import { useLanguage } from '@/lib/i18n/language-context';

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
  const { t } = useLanguage();
  const f = t.features.supplierDiscovery;
  const icons = [Globe, Filter, Star, TrendingUp];
  return (
    <FeatureSection
      id="features"
      badge={f.badge}
      title={f.title}
      description={f.description}
      icon={Search}
      details={f.details.map((text, i) => ({ icon: icons[i], text }))}
    />
  );
}

export function AIIntelligence() {
  const { t } = useLanguage();
  const f = t.features.aiIntelligence;
  const icons = [BrainCircuit, TrendingUp, FileCheck, Star];
  return (
    <FeatureSection
      badge={f.badge}
      title={f.title}
      description={f.description}
      icon={BrainCircuit}
      reversed
      details={f.details.map((text, i) => ({ icon: icons[i], text }))}
    />
  );
}

export function Onboarding() {
  const { t } = useLanguage();
  const f = t.features.onboarding;
  const icons = [Users, FileCheck, UserCheck, Building2];
  return (
    <FeatureSection
      id="about"
      badge={f.badge}
      title={f.title}
      description={f.description}
      icon={UserCheck}
      details={f.details.map((text, i) => ({ icon: icons[i], text }))}
    />
  );
}

export function ERPIntegration() {
  const { t } = useLanguage();
  const f = t.features.erp;
  const icons = [ArrowLeftRight, Plug, FileCheck, Building2];
  return (
    <FeatureSection
      badge={f.badge}
      title={f.title}
      description={f.description}
      icon={Plug}
      reversed
      details={f.details.map((text, i) => ({ icon: icons[i], text }))}
    />
  );
}
