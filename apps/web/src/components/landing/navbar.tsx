'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Menu, X, Hexagon, LogOut, User, Settings, LayoutDashboard, ChevronDown } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'About', href: '#about' },
  { label: 'Contact', href: '#contact' },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated' && !!session;
  const isOnboarded = isAuthenticated && (session as any)?.user?.onboarded;
  const authLink = isOnboarded ? '/dashboard' : '/onboarding';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
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
                <ChevronDown className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              </button>

              {/* Dropdown Menu */}
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-1 shadow-lg">
                  <div className="border-b border-[hsl(var(--border))] px-4 py-3">
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                      {session.user?.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[hsl(var(--muted-foreground))]">
                      {session.user?.email}
                    </p>
                  </div>
                  {isOnboarded && (
                    <a
                      href="/dashboard"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))]"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      Dashboard
                    </a>
                  )}
                  <a
                    href="/settings"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))]"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </a>
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      signOut({ callbackUrl: '/' });
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-500 transition-colors hover:bg-[hsl(var(--muted))]"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
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
                <div className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {session.user?.image ? (
                      <img src={session.user.image} alt="" className="h-10 w-10 rounded-full" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-sm font-bold text-white">
                        {session.user?.name?.charAt(0) || '?'}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">
                        {session.user?.name}
                      </p>
                      <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                        {session.user?.email}
                      </p>
                    </div>
                  </div>
                </div>
                {isOnboarded && (
                  <a
                    href="/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))]"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </a>
                )}
                <a
                  href="/settings"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))]"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </a>
                <button
                  onClick={() => { signOut({ callbackUrl: '/' }); setMobileOpen(false); }}
                  className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-red-500 transition-colors hover:bg-[hsl(var(--muted))]"
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
