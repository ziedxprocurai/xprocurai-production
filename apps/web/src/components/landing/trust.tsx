'use client';

import { ShieldCheck, BadgeCheck } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/language-context';

export function Trust() {
  const { t } = useLanguage();

  return (
    <section className="relative py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))]/10 px-3.5 py-1 text-xs font-semibold tracking-wide text-[hsl(var(--primary))] uppercase">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t.trust.badge}
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-[hsl(var(--foreground))] sm:text-4xl">
            {t.trust.title}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-[hsl(var(--muted-foreground))]">
            {t.trust.subtitle}
          </p>
        </div>

        <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {t.trust.items.map((item) => (
            <div
              key={item.name}
              className="group flex flex-col items-center gap-3 rounded-2xl border border-[hsl(var(--border))]/50 bg-[hsl(var(--background))] p-6 text-center shadow-sm transition-all hover:border-[hsl(var(--primary))]/30 hover:shadow-md"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[hsl(var(--primary))]/10 ring-1 ring-[hsl(var(--primary))]/15 transition-colors group-hover:bg-[hsl(var(--primary))]/15">
                <BadgeCheck className="h-7 w-7 text-[hsl(var(--primary))]" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{item.name}</p>
                <p className="mt-1 text-xs leading-snug text-[hsl(var(--muted-foreground))]">{item.note}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-[hsl(var(--muted-foreground))]/70">
          {t.trust.disclaimer}
        </p>
      </div>
    </section>
  );
}
