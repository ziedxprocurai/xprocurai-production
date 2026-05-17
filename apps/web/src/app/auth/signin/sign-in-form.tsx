'use client';

import { signIn } from 'next-auth/react';
import { Hexagon, Chrome } from 'lucide-react';
import { useState } from 'react';

export function SignInForm() {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signIn('google', { callbackUrl: '/onboarding' });
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--primary))]">
          <Hexagon className="h-6 w-6 text-white" strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
          Welcome to xProcur<span className="text-[hsl(var(--primary))]">AI</span>
        </h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Sign in to access the Supplier Intelligence Platform
        </p>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3.5 text-sm font-semibold text-[hsl(var(--foreground))] transition-all hover:bg-[hsl(var(--muted))] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[hsl(var(--muted-foreground))] border-t-transparent" />
          ) : (
            <Chrome className="h-5 w-5" />
          )}
          {loading ? 'Signing in...' : 'Continue with Google'}
        </button>

        <div className="mt-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-[hsl(var(--border))]" />
          <span className="text-xs text-[hsl(var(--muted-foreground))]">or</span>
          <div className="h-px flex-1 bg-[hsl(var(--border))]" />
        </div>

        <p className="mt-5 text-center text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
          More sign-in options coming soon.
          <br />
          Enterprise SSO (SAML/OIDC) available on request.
        </p>
      </div>

      {/* Footer */}
      <p className="mt-6 text-center text-xs text-[hsl(var(--muted-foreground))]/60">
        By signing in, you agree to our{' '}
        <a href="#" className="underline hover:text-[hsl(var(--foreground))]">
          Terms of Service
        </a>{' '}
        and{' '}
        <a href="#" className="underline hover:text-[hsl(var(--foreground))]">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
}
