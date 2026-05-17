'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Menu, X, Hexagon, LogOut } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'About', href: '#about' },
  { label: 'Contact', href: '#contact' },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated' && !!session;

  return (
    <header className="fixed top-0 z-50 w-full border-b border-[hsl(var(--border))]/40 bg-[hsl(var(--background))]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--primary))]">
            <Hexagon className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-xl font-bold tracking-tight text-[hsl(var(--foreground))]">
            xProcur<span className="text-[hsl(var(--primary))]">AI</span>
          </span>
        </a>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-4 py-2 text-sm font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle />
          {isAuthenticated ? (
            <>
              <a
                href="/onboarding"
                className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))]"
              >
                {session.user?.image ? (
                  <img
                    src={session.user.image}
                    alt=""
                    className="h-7 w-7 rounded-full"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-xs font-bold text-white">
                    {session.user?.name?.charAt(0) || '?'}
                  </div>
                )}
                <span className="max-w-[120px] truncate">{session.user?.name}</span>
              </a>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <a
                href="/auth/signin"
                className="rounded-lg px-4 py-2 text-sm font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
              >
                Sign In
              </a>
              <a
                href="/auth/signin"
                className="rounded-lg bg-[hsl(var(--primary))] px-5 py-2 text-sm font-medium text-white shadow-sm transition-all hover:opacity-90"
              >
                Start Free
              </a>
            </>
          )}
        </div>

        {/* Mobile Toggle */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))]"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="border-t border-[hsl(var(--border))]/40 bg-[hsl(var(--background))] px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
              >
                {link.label}
              </a>
            ))}
            <hr className="my-2 border-[hsl(var(--border))]/40" />
            {isAuthenticated ? (
              <>
                <a
                  href="/onboarding"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))]"
                >
                  {session.user?.image ? (
                    <img src={session.user.image} alt="" className="h-7 w-7 rounded-full" />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-xs font-bold text-white">
                      {session.user?.name?.charAt(0) || '?'}
                    </div>
                  )}
                  {session.user?.name}
                </a>
                <button
                  onClick={() => { signOut({ callbackUrl: '/' }); setMobileOpen(false); }}
                  className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-red-500 transition-colors hover:bg-[hsl(var(--muted))]"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <a
                  href="/auth/signin"
                  className="rounded-lg px-4 py-2.5 text-sm font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))]"
                >
                  Sign In
                </a>
                <a
                  href="/auth/signin"
                  className="mt-1 rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-center text-sm font-medium text-white"
                >
                  Start Free
                </a>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
