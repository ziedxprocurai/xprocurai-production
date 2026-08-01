'use client';

import { useState, useEffect, ReactNode } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Hexagon,
  LogOut,
  Settings,
  BarChart3,
  Package,
  TrendingUp,
  FileText,
  Menu,
  X,
  Sun,
  Moon,
  ChevronDown,
  Home,
  ShoppingCart,
  FileSpreadsheet,
  Compass,
} from 'lucide-react';
import { useTheme } from '@/components/theme-provider';

const NAV_ITEMS = [
  { label: 'Home', icon: Home, href: '/dashboard' },
  { label: 'X Discovery', icon: Compass, href: '/dashboard/discovery' },
  { label: 'Products', icon: Package, href: '/dashboard/products' },
  { label: 'RFQs', icon: FileText, href: '/dashboard/rfqs' },
  { label: 'ERP Integration', icon: TrendingUp, href: '/dashboard/erp' },
  { label: 'Provider Import', icon: FileSpreadsheet, href: '/dashboard/provider-import' },
  { label: 'Suppliers', icon: ShoppingCart, href: '/suppliers' },
  { label: 'Analytics', icon: BarChart3, href: '/analytics' },
  { label: 'Reports', icon: FileText, href: '/reports' },
  { label: 'Settings', icon: Settings, href: '/settings' },
];

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-[hsl(var(--background))]">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center gap-3 border-b border-[hsl(var(--border))] px-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
              <Hexagon className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-[hsl(var(--foreground))]">xProcurAI</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 overflow-y-auto p-4">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
              return (
                <button
                  key={item.href}
                  onClick={() => {
                    router.push(item.href);
                    setSidebarOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[hsl(var(--primary))] text-white shadow-sm'
                      : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* User Menu */}
          <div className="border-t border-[hsl(var(--border))] p-4">
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-[hsl(var(--muted))]"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-xs font-bold text-white">
                  {session?.user?.name?.[0]?.toUpperCase() || session?.user?.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="flex-1 overflow-hidden text-left">
                  <div className="truncate font-medium text-[hsl(var(--foreground))]">
                    {session?.user?.name || 'User'}
                  </div>
                  <div className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                    {session?.user?.email}
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg">
                    <button
                      onClick={() => {
                        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
                        setUserMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                    >
                      {resolvedTheme === 'dark' ? (
                        <Sun className="h-4 w-4" />
                      ) : (
                        <Moon className="h-4 w-4" />
                      )}
                      {resolvedTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                    </button>
                    <button
                      onClick={() => router.push('/settings')}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </button>
                    <button
                      onClick={() => signOut({ callbackUrl: '/' })}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10"
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

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 hover:bg-[hsl(var(--muted))] lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="hidden rounded-lg p-2 hover:bg-[hsl(var(--muted))] lg:block"
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
