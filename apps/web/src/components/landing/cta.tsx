import { ArrowRight, Chrome } from 'lucide-react';

export function CTA() {
  return (
    <section id="contact" className="relative overflow-hidden py-24 lg:py-32">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--primary))]/5 via-[hsl(var(--primary))]/10 to-[hsl(var(--primary))]/5" />
        <div className="absolute top-0 left-1/2 h-px w-full max-w-4xl -translate-x-1/2 bg-gradient-to-r from-transparent via-[hsl(var(--primary))]/30 to-transparent" />
        <div className="absolute bottom-0 left-1/2 h-px w-full max-w-4xl -translate-x-1/2 bg-gradient-to-r from-transparent via-[hsl(var(--primary))]/30 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-[hsl(var(--foreground))] sm:text-4xl lg:text-5xl">
          Ready to transform your
          <br />
          <span className="bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(250,80%,60%)] bg-clip-text text-transparent">
            procurement workflow?
          </span>
        </h2>

        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[hsl(var(--muted-foreground))]">
          Join 50+ enterprise teams already using xProcurAI to discover suppliers,
          automate onboarding, and build intelligence-driven supply chains.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="/auth/signin"
            className="group inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-[hsl(var(--primary))]/25 transition-all hover:shadow-xl hover:shadow-[hsl(var(--primary))]/30 hover:opacity-95"
          >
            Start Free — No Credit Card
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
          <a
            href="/auth/signin"
            className="inline-flex items-center gap-2.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-8 py-4 text-sm font-semibold text-[hsl(var(--foreground))] shadow-sm transition-all hover:bg-[hsl(var(--muted))]/80"
          >
            <Chrome className="h-4 w-4" />
            Sign in with Google
          </a>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-[hsl(var(--muted-foreground))]/70">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Free 14-day trial
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            No credit card required
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Cancel anytime
          </span>
        </div>
      </div>
    </section>
  );
}
