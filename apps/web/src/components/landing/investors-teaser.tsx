'use client';

import { TrendingUp, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/language-context';

export function InvestorsTeaser() {
  const { t } = useLanguage();

  return (
    <section className="relative overflow-hidden py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="relative overflow-hidden rounded-3xl border border-[hsl(var(--border))]/50 bg-gradient-to-br from-[hsl(var(--primary))]/10 via-[hsl(var(--background))] to-[hsl(250,80%,60%)]/10 px-8 py-16 text-center sm:px-16">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 left-1/4 h-72 w-72 rounded-full bg-[hsl(var(--primary))]/10 blur-3xl" />
            <div className="absolute -bottom-24 right-1/4 h-72 w-72 rounded-full bg-[hsl(250,80%,60%)]/10 blur-3xl" />
          </div>

          <div className="relative mx-auto max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))]/60 bg-[hsl(var(--background))]/80 px-4 py-1.5 text-xs font-semibold tracking-wide text-[hsl(var(--primary))] uppercase">
              <TrendingUp className="h-3.5 w-3.5" />
              {t.investorsTeaser.badge}
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-[hsl(var(--foreground))] sm:text-4xl">
              {t.investorsTeaser.title}
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-[hsl(var(--muted-foreground))]">
              {t.investorsTeaser.description}
            </p>
            <a
              href="/investors"
              className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[hsl(var(--primary))]/25 transition-all hover:shadow-xl hover:shadow-[hsl(var(--primary))]/30 hover:opacity-95"
            >
              {t.investorsTeaser.cta}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
