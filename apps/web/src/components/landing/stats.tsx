'use client';

import { Globe2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/language-context';

export function Stats() {
  const { t } = useLanguage();

  return (
    <section className="relative overflow-hidden py-20 lg:py-24">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[hsl(var(--primary))]/[0.03] to-transparent" />
      </div>
      <div className="relative mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))]/10 px-3.5 py-1 text-xs font-semibold tracking-wide text-[hsl(var(--primary))] uppercase">
            <Globe2 className="h-3.5 w-3.5" />
            {t.stats.badge}
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-[hsl(var(--foreground))] sm:text-4xl">
            {t.stats.title}
          </h2>
        </div>

        <div className="mt-14 grid grid-cols-2 gap-6 lg:grid-cols-4">
          {t.stats.items.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-[hsl(var(--border))]/50 bg-gradient-to-b from-[hsl(var(--muted))]/40 to-[hsl(var(--background))] p-6 text-center sm:p-8"
            >
              <p className="bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(250,80%,60%)] bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
                {stat.value}
              </p>
              <p className="mt-2 text-sm leading-snug text-[hsl(var(--muted-foreground))]">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
