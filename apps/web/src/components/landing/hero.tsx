import { ArrowRight, Chrome } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 lg:pt-40 lg:pb-32">
      {/* Background gradient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-[hsl(var(--primary))]/5 blur-3xl" />
        <div className="absolute top-20 -left-40 h-[400px] w-[400px] rounded-full bg-[hsl(221,83%,53%)]/5 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-px w-full max-w-5xl -translate-x-1/2 bg-gradient-to-r from-transparent via-[hsl(var(--border))]/60 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 text-center">
        {/* Badge */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))]/60 bg-[hsl(var(--muted))]/50 px-4 py-1.5 text-sm text-[hsl(var(--muted-foreground))]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Now in Early Access — AI-Powered Procurement
        </div>

        {/* Headline */}
        <h1 className="mx-auto max-w-4xl text-4xl font-bold leading-[1.1] tracking-tight text-[hsl(var(--foreground))] sm:text-5xl md:text-6xl lg:text-7xl">
          Discover, qualify &amp; manage
          <br />
          <span className="bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(221,91%,60%)] to-[hsl(250,80%,60%)] bg-clip-text text-transparent">
            suppliers intelligently
          </span>
        </h1>

        {/* Subheadline */}
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[hsl(var(--muted-foreground))] md:text-xl">
          The AI-powered Supplier Intelligence Platform that helps enterprises discover
          new suppliers, streamline onboarding, and prepare for ERP/SAP integration — all
          from a single pane of glass.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="/auth/signin"
            className="group inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[hsl(var(--primary))]/25 transition-all hover:shadow-xl hover:shadow-[hsl(var(--primary))]/30 hover:opacity-95"
          >
            Start Free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
          <a
            href="/auth/signin"
            className="inline-flex items-center gap-2.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-7 py-3.5 text-sm font-semibold text-[hsl(var(--foreground))] shadow-sm transition-all hover:bg-[hsl(var(--muted))]/80"
          >
            <Chrome className="h-4 w-4" />
            Sign in with Google
          </a>
        </div>

        {/* Social proof */}
        <p className="mt-12 text-sm text-[hsl(var(--muted-foreground))]/70">
          Trusted by procurement teams at 50+ enterprises worldwide
        </p>

        {/* Dashboard preview */}
        <div className="relative mx-auto mt-16 max-w-5xl">
          <div className="rounded-2xl border border-[hsl(var(--border))]/50 bg-gradient-to-b from-[hsl(var(--muted))]/50 to-[hsl(var(--background))] p-2 shadow-2xl shadow-black/5">
            <div className="overflow-hidden rounded-xl border border-[hsl(var(--border))]/30 bg-[hsl(var(--background))]">
              <div className="flex items-center gap-2 border-b border-[hsl(var(--border))]/40 px-4 py-3">
                <div className="h-3 w-3 rounded-full bg-red-400/70" />
                <div className="h-3 w-3 rounded-full bg-yellow-400/70" />
                <div className="h-3 w-3 rounded-full bg-emerald-400/70" />
                <div className="ml-4 h-5 flex-1 rounded-md bg-[hsl(var(--muted))]/60" />
              </div>
              <div className="grid grid-cols-12 gap-3 p-6">
                <div className="col-span-3 space-y-3">
                  <div className="h-4 w-3/4 rounded bg-[hsl(var(--muted))]/70" />
                  <div className="h-3 w-full rounded bg-[hsl(var(--muted))]/40" />
                  <div className="h-3 w-full rounded bg-[hsl(var(--muted))]/40" />
                  <div className="h-3 w-5/6 rounded bg-[hsl(var(--primary))]/20" />
                  <div className="h-3 w-full rounded bg-[hsl(var(--muted))]/40" />
                  <div className="h-3 w-4/5 rounded bg-[hsl(var(--muted))]/40" />
                </div>
                <div className="col-span-9 space-y-3">
                  <div className="flex gap-3">
                    <div className="h-24 flex-1 rounded-lg bg-[hsl(var(--primary))]/10" />
                    <div className="h-24 flex-1 rounded-lg bg-emerald-500/10" />
                    <div className="h-24 flex-1 rounded-lg bg-amber-500/10" />
                  </div>
                  <div className="h-40 rounded-lg bg-[hsl(var(--muted))]/30" />
                </div>
              </div>
            </div>
          </div>
          {/* Glow behind preview */}
          <div className="pointer-events-none absolute inset-0 -z-10 translate-y-8 blur-3xl">
            <div className="mx-auto h-full w-3/4 rounded-full bg-[hsl(var(--primary))]/5" />
          </div>
        </div>
      </div>
    </section>
  );
}
