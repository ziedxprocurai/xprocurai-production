'use client';

import { Navbar, Footer } from '@/components/landing';
import { useLanguage } from '@/lib/i18n/language-context';
import { Code2, Briefcase, Mail, Linkedin, Users } from 'lucide-react';

const AVATAR_SEEDS = ['Zied-xProcurAI', 'Aziz-xProcurAI', 'Ayoub-xProcurAI', 'Ghazi-xProcurAI'];
const ROLE_ICONS = [Code2, Code2, Briefcase, Briefcase];
const EMAILS = ['zied@xprocur.ai', 'aziz@xprocur.ai', 'ayoub@xprocur.ai', 'ghazi@xprocur.ai'];

export function FoundersContent() {
  const { t } = useLanguage();

  return (
    <>
      <Navbar />
      <main className="flex min-h-screen flex-col">
        {/* Hero */}
        <section className="relative overflow-hidden pt-32 pb-16 lg:pt-40 lg:pb-20">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-[hsl(var(--primary))]/5 blur-3xl" />
            <div className="absolute top-20 -left-40 h-[400px] w-[400px] rounded-full bg-[hsl(221,83%,53%)]/5 blur-3xl" />
          </div>
          <div className="relative mx-auto max-w-3xl px-6 text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))]/60 bg-[hsl(var(--muted))]/50 px-4 py-1.5 text-sm text-[hsl(var(--muted-foreground))]">
              <Users className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
              {t.founders.badge}
            </div>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-[hsl(var(--foreground))] sm:text-5xl">
              {t.founders.title}
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[hsl(var(--muted-foreground))]">
              {t.founders.subtitle}
            </p>
          </div>
        </section>

        {/* Team grid */}
        <section className="pb-20 lg:pb-28">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 sm:grid-cols-2 lg:grid-cols-4">
            {t.founders.members.map((member, i) => {
              const RoleIcon = ROLE_ICONS[i];
              return (
                <div
                  key={member.name}
                  className="group flex flex-col items-center rounded-2xl border border-[hsl(var(--border))]/50 bg-[hsl(var(--background))] p-8 text-center shadow-sm transition-all hover:-translate-y-1 hover:border-[hsl(var(--primary))]/30 hover:shadow-lg"
                >
                  <div className="relative">
                    <img
                      src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${AVATAR_SEEDS[i]}&backgroundType=gradientLinear`}
                      alt={member.name}
                      className="h-28 w-28 rounded-2xl bg-[hsl(var(--muted))] ring-1 ring-[hsl(var(--border))]"
                    />
                    <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--primary))] ring-4 ring-[hsl(var(--background))]">
                      <RoleIcon className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-[hsl(var(--foreground))]">{member.name}</h3>
                  <p className="mt-1 text-sm font-medium text-[hsl(var(--primary))]">{member.role}</p>
                  <p className="mt-3 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                    {member.bio}
                  </p>
                  <div className="mt-5 flex items-center gap-2">
                    <a
                      href={`mailto:${EMAILS[i]}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
                      aria-label={`Email ${member.name}`}
                    >
                      <Mail className="h-4 w-4" />
                    </a>
                    <a
                      href="#"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
                      aria-label={`LinkedIn ${member.name}`}
                    >
                      <Linkedin className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden py-20 lg:py-28">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--primary))]/5 via-[hsl(var(--primary))]/10 to-[hsl(var(--primary))]/5" />
          </div>
          <div className="relative mx-auto max-w-2xl px-6 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-[hsl(var(--foreground))] sm:text-4xl">
              {t.founders.cta.title}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-[hsl(var(--muted-foreground))]">
              {t.founders.cta.subtitle}
            </p>
            <a
              href="mailto:contact@xprocur.ai"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[hsl(var(--primary))]/25 transition-all hover:shadow-xl hover:shadow-[hsl(var(--primary))]/30 hover:opacity-95"
            >
              <Mail className="h-4 w-4" />
              {t.founders.cta.button}
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
