'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Building2,
  Globe,
  MapPin,
  Phone,
  Mail,
  Users,
  Factory,
  ShoppingCart,
  Hexagon,
  LogOut,
  Settings,
  BarChart3,
  Package,
  TrendingUp,
  FileText,
  Bell,
  Home,
  Loader2,
  Menu,
  X,
  Sun,
  Moon,
  ChevronDown,
  Shield,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  FileSpreadsheet,
  Compass,
} from 'lucide-react';
import { useTheme } from '@/components/theme-provider';

interface Company {
  id: string;
  legalName: string;
  website?: string;
  country: string;
  city?: string;
  industry?: string;
  companySize?: string;
  phoneNumber?: string;
  email?: string;
  description?: string;
  roles: string[];
  onboardingStatus: string;
  verificationStatus: string;
  users: { id: string; email: string; fullName?: string; role?: string }[];
}

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

const SIZE_LABELS: Record<string, string> = {
  SOLE_PROPRIETOR: 'Sole Proprietor',
  SMALL: 'Small (2–50)',
  MEDIUM: 'Medium (51–250)',
  LARGE: 'Large (251–1000)',
  ENTERPRISE: 'Enterprise (1000+)',
};

export function DashboardContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    async function fetchCompany() {
      try {
        const res = await fetch('/api/companies/me');
        if (res.ok) {
          const data = await res.json();
          setCompany(data);
        } else if (res.status === 401) {
          router.push('/auth/signin');
        } else {
          setError('Failed to load company data');
        }
      } catch {
        setError('Unable to connect to the server');
      } finally {
        setLoading(false);
      }
    }
    fetchCompany();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = session?.user?.name?.split(' ')[0] || 'there';

  return (
    <div className="flex min-h-screen bg-[hsl(var(--background))]">
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
              <span className="text-lg font-bold text-[hsl(var(--foreground))]">
                xProcur<span className="text-[hsl(var(--primary))]">AI</span>
              </span>
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
                    {session?.user?.email}
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

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1">
        {/* Top Bar (Mobile) */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 px-6 backdrop-blur-md lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))]"
          >
            <Menu className="h-5 w-5" />
          </button>
          <a href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--primary))]">
              <Hexagon className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-bold text-[hsl(var(--foreground))]">
              xProcur<span className="text-[hsl(var(--primary))]">AI</span>
            </span>
          </a>
          <button className="relative rounded-lg p-2 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))]">
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[hsl(var(--primary))]" />
          </button>
        </header>

        {/* Page Content */}
        <main className="p-6 lg:p-8">
          {/* Greeting */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
              {greeting()}, {firstName}
            </h1>
            <p className="mt-1 text-[hsl(var(--muted-foreground))]">
              Here&apos;s an overview of your procurement platform.
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-500">
              {error}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Company Profile Card */}
            <div className="lg:col-span-2">
              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-[hsl(var(--foreground))]">
                    <Building2 className="h-5 w-5 text-[hsl(var(--primary))]" />
                    Company Profile
                  </h2>
                  <div className="flex gap-2">
                    {company?.verificationStatus && (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                          company.verificationStatus === 'VERIFIED'
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : company.verificationStatus === 'IN_PROGRESS'
                              ? 'bg-blue-500/10 text-blue-500'
                              : company.verificationStatus === 'REJECTED'
                                ? 'bg-red-500/10 text-red-500'
                                : 'bg-amber-500/10 text-amber-500'
                        }`}
                      >
                        {company.verificationStatus === 'VERIFIED' ? (
                          <>
                            <CheckCircle className="h-3 w-3" />
                            Verified
                          </>
                        ) : company.verificationStatus === 'IN_PROGRESS' ? (
                          <>
                            <AlertCircle className="h-3 w-3" />
                            Verification in Progress
                          </>
                        ) : company.verificationStatus === 'REJECTED' ? (
                          <>
                            <XCircle className="h-3 w-3" />
                            Rejected
                          </>
                        ) : (
                          <>
                            <Clock className="h-3 w-3" />
                            Pending Verification
                          </>
                        )}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        company?.onboardingStatus === 'COMPLETED'
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : 'bg-amber-500/10 text-amber-500'
                      }`}
                    >
                      {company?.onboardingStatus === 'COMPLETED' ? 'Active' : 'Setup in progress'}
                    </span>
                  </div>
                </div>

                {company ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-bold text-[hsl(var(--foreground))]">
                        {company.legalName}
                      </h3>
                      <div className="flex gap-1.5">
                        {company.roles.map((role) => (
                          <span
                            key={role}
                            className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--primary))]/10 px-2.5 py-0.5 text-xs font-medium text-[hsl(var(--primary))]"
                          >
                            {role === 'BUYER' ? (
                              <ShoppingCart className="h-3 w-3" />
                            ) : (
                              <Factory className="h-3 w-3" />
                            )}
                            {role}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <InfoRow
                        icon={<MapPin className="h-4 w-4" />}
                        label="Location"
                        value={[company.city, company.country].filter(Boolean).join(', ')}
                      />
                      {company.industry && (
                        <InfoRow
                          icon={<Factory className="h-4 w-4" />}
                          label="Industry"
                          value={company.industry}
                        />
                      )}
                      {company.companySize && (
                        <InfoRow
                          icon={<Users className="h-4 w-4" />}
                          label="Size"
                          value={SIZE_LABELS[company.companySize] || company.companySize}
                        />
                      )}
                      {company.website && (
                        <InfoRow
                          icon={<Globe className="h-4 w-4" />}
                          label="Website"
                          value={company.website}
                          href={company.website}
                        />
                      )}
                      {company.phoneNumber && (
                        <InfoRow
                          icon={<Phone className="h-4 w-4" />}
                          label="Phone"
                          value={company.phoneNumber}
                        />
                      )}
                      {company.email && (
                        <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={company.email} />
                      )}
                    </div>

                    {company.description && (
                      <div className="mt-2 rounded-lg bg-[hsl(var(--muted))]/50 px-4 py-3">
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                          {company.description}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                      No company data found. Please complete onboarding.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Stats Sidebar */}
            <div className="space-y-6">
              {/* Team Members */}
              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  <Users className="h-4 w-4" />
                  Team
                </h2>
                {company?.users && company.users.length > 0 ? (
                  <div className="space-y-3">
                    {company.users.map((user) => (
                      <div key={user.id} className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10 text-xs font-bold text-[hsl(var(--primary))]">
                          {(user.fullName || user.email)[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">
                            {user.fullName || 'Unnamed'}
                          </p>
                          <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">No team members yet</p>
                )}
              </div>

              {/* Quick Stats */}
              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  <TrendingUp className="h-4 w-4" />
                  Overview
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <StatCard label="Suppliers" value="0" />
                  <StatCard label="RFQs" value="0" />
                  <StatCard label="Orders" value="0" />
                  <StatCard label="Saved" value="0" />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-[hsl(var(--muted))]/30 px-3 py-2.5">
      <span className="text-[hsl(var(--muted-foreground))]">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-sm font-medium text-[hsl(var(--primary))] hover:underline"
          >
            {value}
          </a>
        ) : (
          <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">{value}</p>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[hsl(var(--muted))]/30 p-3 text-center">
      <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{value}</p>
      <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
    </div>
  );
}
