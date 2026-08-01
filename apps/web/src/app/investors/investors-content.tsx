'use client';

import { useState } from 'react';
import { Navbar, Footer } from '@/components/landing';
import { useLanguage } from '@/lib/i18n/language-context';
import {
  TrendingUp,
  Target,
  Sparkles,
  Globe,
  ShieldCheck,
  Users2,
  Mail,
  Send,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

const WHY_ICONS = [Sparkles, Globe, ShieldCheck, Users2];

export function InvestorsContent() {
  const { t } = useLanguage();
  const inv = t.investors;
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', company: '', message: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const subject = encodeURIComponent(`Investment inquiry from ${form.name || 'a prospective investor'}`);
    const body = encodeURIComponent(
      `Name: ${form.name}\nEmail: ${form.email}\nCompany / Fund: ${form.company}\n\n${form.message}`
    );
    window.location.href = `mailto:investors@xprocur.ai?subject=${subject}&body=${body}`;
    window.setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 400);
  };

  return (
    <>
      <Navbar />
      <main className="flex min-h-screen flex-col">
        {/* Hero */}
        <section className="relative overflow-hidden pt-32 pb-20 lg:pt-40 lg:pb-24">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-[hsl(var(--primary))]/5 blur-3xl" />
            <div className="absolute top-20 -left-40 h-[400px] w-[400px] rounded-full bg-[hsl(250,80%,60%)]/5 blur-3xl" />
          </div>
          <div className="relative mx-auto max-w-4xl px-6 text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))]/60 bg-[hsl(var(--muted))]/50 px-4 py-1.5 text-sm text-[hsl(var(--muted-foreground))]">
              <TrendingUp className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
              {inv.hero.badge}
            </div>
            <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight text-[hsl(var(--foreground))] sm:text-5xl lg:text-6xl">
              {inv.hero.title1}
              <br />
              <span className="bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(221,91%,60%)] to-[hsl(250,80%,60%)] bg-clip-text text-transparent">
                {inv.hero.title2}
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[hsl(var(--muted-foreground))]">
              {inv.hero.subtitle}
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href="#contact-investors"
                className="group inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[hsl(var(--primary))]/25 transition-all hover:shadow-xl hover:shadow-[hsl(var(--primary))]/30 hover:opacity-95"
              >
                {inv.hero.ctaPrimary}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
              </a>
              <a
                href="/founders"
                className="inline-flex items-center gap-2.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-7 py-3.5 text-sm font-semibold text-[hsl(var(--foreground))] shadow-sm transition-all hover:bg-[hsl(var(--muted))]/80"
              >
                {inv.hero.ctaSecondary}
              </a>
            </div>
          </div>
        </section>

        <div className="mx-auto h-px w-full max-w-5xl bg-gradient-to-r from-transparent via-[hsl(var(--border))]/60 to-transparent" />

        {/* Market opportunity */}
        <section className="py-20 lg:py-24">
          <div className="mx-auto max-w-5xl px-6 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))]/10 px-3.5 py-1 text-xs font-semibold tracking-wide text-[hsl(var(--primary))] uppercase">
              <Target className="h-3.5 w-3.5" />
              {inv.opportunity.badge}
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-[hsl(var(--foreground))] sm:text-4xl">
              {inv.opportunity.title}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-[hsl(var(--muted-foreground))]">
              {inv.opportunity.description}
            </p>

            <div className="mt-12 grid grid-cols-2 gap-6 lg:grid-cols-4">
              {inv.opportunity.stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-[hsl(var(--border))]/50 bg-gradient-to-b from-[hsl(var(--muted))]/40 to-[hsl(var(--background))] p-6 text-center"
                >
                  <p className="bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(250,80%,60%)] bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
                    {stat.value}
                  </p>
                  <p className="mt-2 text-sm leading-snug text-[hsl(var(--muted-foreground))]">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="mx-auto h-px w-full max-w-5xl bg-gradient-to-r from-transparent via-[hsl(var(--border))]/60 to-transparent" />

        {/* Why invest */}
        <section className="py-20 lg:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))]/10 px-3.5 py-1 text-xs font-semibold tracking-wide text-[hsl(var(--primary))] uppercase">
                {inv.whyInvest.badge}
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-[hsl(var(--foreground))] sm:text-4xl">
                {inv.whyInvest.title}
              </h2>
            </div>

            <div className="mt-14 grid gap-6 sm:grid-cols-2">
              {inv.whyInvest.items.map((item, i) => {
                const Icon = WHY_ICONS[i];
                return (
                  <div
                    key={item.title}
                    className="flex gap-4 rounded-2xl border border-[hsl(var(--border))]/50 bg-[hsl(var(--background))] p-6 shadow-sm transition-all hover:border-[hsl(var(--primary))]/30 hover:shadow-md"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--primary))]/10 ring-1 ring-[hsl(var(--primary))]/15">
                      <Icon className="h-5 w-5 text-[hsl(var(--primary))]" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-[hsl(var(--foreground))]">{item.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                        {item.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <div className="mx-auto h-px w-full max-w-5xl bg-gradient-to-r from-transparent via-[hsl(var(--border))]/60 to-transparent" />

        {/* Traction */}
        <section className="py-20 lg:py-24">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-[hsl(var(--foreground))] sm:text-4xl">
              {inv.traction.title}
            </h2>
            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
              {inv.traction.items.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-[hsl(var(--border))]/50 bg-gradient-to-b from-[hsl(var(--muted))]/40 to-[hsl(var(--background))] p-8"
                >
                  <p className="bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(250,80%,60%)] bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">
                    {item.value}
                  </p>
                  <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact */}
        <section id="contact-investors" className="relative overflow-hidden py-20 lg:py-28">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--primary))]/5 via-[hsl(var(--primary))]/10 to-[hsl(var(--primary))]/5" />
          </div>
          <div className="relative mx-auto max-w-xl px-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-[hsl(var(--foreground))] sm:text-4xl">
                {inv.contact.title}
              </h2>
              <p className="mx-auto mt-4 max-w-md text-lg leading-relaxed text-[hsl(var(--muted-foreground))]">
                {inv.contact.subtitle}
              </p>
            </div>

            <div className="mt-10 rounded-2xl border border-[hsl(var(--border))]/50 bg-[hsl(var(--background))] p-6 shadow-sm sm:p-8">
              {submitted ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                  <p className="mt-4 text-base font-medium text-[hsl(var(--foreground))]">
                    {inv.contact.form.success}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
                        {inv.contact.form.name}
                      </label>
                      <input
                        required
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="field-input"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
                        {inv.contact.form.email}
                      </label>
                      <input
                        required
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="field-input"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
                      {inv.contact.form.company}
                    </label>
                    <input
                      type="text"
                      value={form.company}
                      onChange={(e) => setForm({ ...form, company: e.target.value })}
                      className="field-input"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
                      {inv.contact.form.message}
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      placeholder={inv.contact.form.messagePlaceholder}
                      className="field-input resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[hsl(var(--primary))]/25 transition-all hover:shadow-xl hover:shadow-[hsl(var(--primary))]/30 hover:opacity-95 disabled:opacity-70"
                  >
                    <Send className="h-4 w-4" />
                    {submitting ? inv.contact.form.submitting : inv.contact.form.submit}
                  </button>
                </form>
              )}
            </div>

            <p className="mt-6 flex items-center justify-center gap-2 text-center text-sm text-[hsl(var(--muted-foreground))]">
              <Mail className="h-4 w-4" />
              {inv.contact.directEmail}{' '}
              <a href="mailto:investors@xprocur.ai" className="font-medium text-[hsl(var(--primary))] hover:opacity-80">
                investors@xprocur.ai
              </a>
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
