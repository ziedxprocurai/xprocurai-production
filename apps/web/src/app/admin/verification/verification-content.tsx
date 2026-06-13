'use client';

import { useState, useEffect } from 'react';
import {
  Building2,
  Check,
  X,
  Clock,
  AlertCircle,
  Loader2,
  ShoppingCart,
  Factory,
  MapPin,
  Users,
  Calendar,
  Search,
  Filter,
} from 'lucide-react';

interface Company {
  id: string;
  legalName: string;
  website?: string;
  country: string;
  city?: string;
  industry?: string;
  companySize?: string;
  roles: string[];
  verificationStatus: string;
  onboardingStatus: string;
  createdAt: string;
  users: { id: string; email: string; fullName?: string }[];
}

const STATUS_CONFIG = {
  PENDING: { label: 'Pending', color: 'bg-amber-500/10 text-amber-500', icon: Clock },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-500/10 text-blue-500', icon: AlertCircle },
  VERIFIED: { label: 'Verified', color: 'bg-emerald-500/10 text-emerald-500', icon: Check },
  REJECTED: { label: 'Rejected', color: 'bg-red-500/10 text-red-500', icon: X },
};

export function VerificationContent() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchCompanies();
  }, []);

  async function fetchCompanies() {
    try {
      const res = await fetch('/api/admin/companies');
      if (res.ok) {
        const data = await res.json();
        setCompanies(data);
      } else {
        setError('Failed to load companies');
      }
    } catch {
      setError('Unable to connect to server');
    } finally {
      setLoading(false);
    }
  }

  async function updateVerificationStatus(companyId: string, status: string) {
    setUpdating(companyId);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/verification-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        const updated = await res.json();
        setCompanies((prev) =>
          prev.map((c) => (c.id === companyId ? { ...c, verificationStatus: updated.verificationStatus } : c))
        );
      } else {
        setError('Failed to update verification status');
      }
    } catch {
      setError('Failed to update verification status');
    } finally {
      setUpdating(null);
    }
  }

  const filteredCompanies = companies.filter((company) => {
    const matchesSearch =
      company.legalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.users.some((u) => u.email.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || company.verificationStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: companies.length,
    pending: companies.filter((c) => c.verificationStatus === 'PENDING').length,
    inProgress: companies.filter((c) => c.verificationStatus === 'IN_PROGRESS').length,
    verified: companies.filter((c) => c.verificationStatus === 'VERIFIED').length,
    rejected: companies.filter((c) => c.verificationStatus === 'REJECTED').length,
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading companies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Trust & Verification</h1>
        <p className="mt-1 text-[hsl(var(--muted-foreground))]">
          Review and manage company verification status
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-500">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total Companies" value={stats.total} color="bg-slate-500/10 text-slate-500" />
        <StatCard label="Pending" value={stats.pending} color="bg-amber-500/10 text-amber-500" />
        <StatCard label="In Progress" value={stats.inProgress} color="bg-blue-500/10 text-blue-500" />
        <StatCard label="Verified" value={stats.verified} color="bg-emerald-500/10 text-emerald-500" />
        <StatCard label="Rejected" value={stats.rejected} color="bg-red-500/10 text-red-500" />
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <input
            type="text"
            placeholder="Search by company name, country, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] py-2 pl-10 pr-4 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2 text-sm text-[hsl(var(--foreground))] focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
        >
          <option value="ALL">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="VERIFIED">Verified</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {/* Companies List */}
      <div className="space-y-4">
        {filteredCompanies.length === 0 ? (
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-[hsl(var(--muted-foreground))]" />
            <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">
              No companies found matching your criteria
            </p>
          </div>
        ) : (
          filteredCompanies.map((company) => (
            <CompanyCard
              key={company.id}
              company={company}
              updating={updating === company.id}
              onUpdateStatus={(status) => updateVerificationStatus(company.id, status)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <p className="text-sm text-[hsl(var(--muted-foreground))]">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color.split(' ')[1]}`}>{value}</p>
    </div>
  );
}

function CompanyCard({
  company,
  updating,
  onUpdateStatus,
}: {
  company: Company;
  updating: boolean;
  onUpdateStatus: (status: string) => void;
}) {
  const statusConfig = STATUS_CONFIG[company.verificationStatus as keyof typeof STATUS_CONFIG];
  const StatusIcon = statusConfig?.icon || Clock;

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        {/* Company Info */}
        <div className="flex-1 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-[hsl(var(--foreground))]">{company.legalName}</h3>
                <div className="flex gap-1.5">
                  {company.roles.map((role) => (
                    <span
                      key={role}
                      className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--primary))]/10 px-2 py-0.5 text-xs font-medium text-[hsl(var(--primary))]"
                    >
                      {role === 'BUYER' ? <ShoppingCart className="h-3 w-3" /> : <Factory className="h-3 w-3" />}
                      {role}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-[hsl(var(--muted-foreground))]">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {[company.city, company.country].filter(Boolean).join(', ')}
                </span>
                {company.industry && (
                  <span className="flex items-center gap-1.5">
                    <Factory className="h-4 w-4" />
                    {company.industry}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  {company.users.length} {company.users.length === 1 ? 'user' : 'users'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {new Date(company.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Users */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Team Members
            </p>
            <div className="flex flex-wrap gap-2">
              {company.users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-2 rounded-lg bg-[hsl(var(--muted))]/30 px-3 py-1.5"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10 text-xs font-bold text-[hsl(var(--primary))]">
                    {(user.fullName || user.email)[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm text-[hsl(var(--foreground))]">
                    {user.fullName || user.email}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Status & Actions */}
        <div className="flex flex-col gap-3 lg:w-64">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Status:
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${statusConfig?.color}`}>
              <StatusIcon className="h-3 w-3" />
              {statusConfig?.label}
            </span>
          </div>

          {updating ? (
            <div className="flex items-center justify-center rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 py-6">
              <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--primary))]" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onUpdateStatus('VERIFIED')}
                disabled={company.verificationStatus === 'VERIFIED'}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-medium text-white transition-all hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="h-3.5 w-3.5" />
                Verify
              </button>
              <button
                onClick={() => onUpdateStatus('REJECTED')}
                disabled={company.verificationStatus === 'REJECTED'}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-red-500 px-3 py-2 text-xs font-medium text-white transition-all hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="h-3.5 w-3.5" />
                Reject
              </button>
              <button
                onClick={() => onUpdateStatus('IN_PROGRESS')}
                disabled={company.verificationStatus === 'IN_PROGRESS'}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-xs font-medium text-[hsl(var(--foreground))] transition-all hover:bg-[hsl(var(--muted))] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <AlertCircle className="h-3.5 w-3.5" />
                In Progress
              </button>
              <button
                onClick={() => onUpdateStatus('PENDING')}
                disabled={company.verificationStatus === 'PENDING'}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-xs font-medium text-[hsl(var(--foreground))] transition-all hover:bg-[hsl(var(--muted))] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Clock className="h-3.5 w-3.5" />
                Pending
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
