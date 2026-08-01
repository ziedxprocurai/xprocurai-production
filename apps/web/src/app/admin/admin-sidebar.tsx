'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import {
  Hexagon,
  Shield,
  Bot,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  ChevronDown,
  Home,
  KeyRound,
  Compass,
} from 'lucide-react';
import { useTheme } from '@/components/theme-provider';

const NAV_ITEMS = [
  { label: 'X Discovery', icon: Compass, href: '/dashboard/discovery' },
  { label: 'Trust & Verification', icon: Shield, href: '/admin/verification' },
  { label: 'AI Scraper', icon: Bot, href: '/admin/scraper' },
  { label: 'Provider Import AI', icon: KeyRound, href: '/admin/provider-import-settings' },
  { label: 'Analytics', icon: BarChart3, href: '/admin/analytics' },
  { label: 'Users', icon: Users, href: '/admin/users' },
];

export function AdminSidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const firstName = session?.user?.name?.split(' ')[0] || 'Admin';

  return (
    <>
      {/* Mobile Header */}
      <header className="fixed top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 px-6 backdrop-blur-md lg:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))]"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--primary))]">
            <Hexagon className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-bold text-[hsl(var(--foreground))]">
            Admin
          </span>
        </div>
        <div className="w-10" />
      </header>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] transition-transform duration-300 lg:relative lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center gap-3 border-b border-[hsl(var(--border))] px-6">
            <a href="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--primary))]">
                <Hexagon className="h-5 w-5 text-white" strokeWidth={2.5} />
              </div>
              <div>
                <span className="text-lg font-bold text-[hsl(var(--foreground))]">
                  xProcur<span className="text-[hsl(var(--primary))]">AI</span>
                </span>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Admin Panel</p>
              </div>
            </a>
          </div>

          {/* Quick Link to User Dashboard */}
          <div className="border-b border-[hsl(var(--border))] p-3">
            <a
              href="/dashboard"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
            >
              <Home className="h-5 w-5" />
              User Dashboard
            </a>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[hsl(var(--primary))] text-white'
                      : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </a>
              );
            })}
          </nav>

          {/* Theme Toggle */}
          <div className="border-t border-[hsl(var(--border))] p-3">
            <button
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
            >
              {resolvedTheme === 'dark' ? (
                <>
                  <Sun className="h-5 w-5" />
                  Light Mode
                </>
              ) : (
                <>
                  <Moon className="h-5 w-5" />
                  Dark Mode
                </>
              )}
            </button>
          </div>

          {/* User Profile */}
          <div className="border-t border-[hsl(var(--border))] p-3">
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[hsl(var(--muted))]"
              >
                {session?.user?.image ? (
                  <img src={session.user.image} alt="" className="h-8 w-8 rounded-full" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-xs font-bold text-white">
                    {firstName[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 text-left">
                  <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">
                    {session?.user?.name}
                  </p>
                  <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                    Administrator
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              </button>

              {/* User Dropdown */}
              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute bottom-full left-3 right-3 z-50 mb-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-1 shadow-lg">
                    <a
                      href="/settings"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))]"
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </a>
                    <button
                      onClick={() => signOut({ callbackUrl: '/' })}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-500 transition-colors hover:bg-[hsl(var(--muted))]"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
