'use client';

import { useState } from 'react';
import {
  Bot,
  Activity,
  Database,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  Building2,
  Globe,
  MapPin,
  Eye,
  Trash2,
  RefreshCw,
  BarChart3,
  Zap,
} from 'lucide-react';

// Mocked data for demonstration
const MOCK_SCRAPING_STATS = {
  currentlyScanning: 12,
  scannedToday: 847,
  totalBusinesses: 15234,
  pendingReview: 156,
};

const MOCK_ACTIVE_SCANS = [
  { id: '1', source: 'LinkedIn', target: 'Manufacturing Companies - USA', progress: 67, status: 'active' },
  { id: '2', source: 'Google Maps', target: 'Suppliers - Europe', progress: 34, status: 'active' },
  { id: '3', source: 'Industry Directory', target: 'Tech Companies - Asia', progress: 89, status: 'active' },
];

const MOCK_SCRAPED_BUSINESSES = [
  {
    id: '1',
    name: 'TechSupply Inc.',
    industry: 'Technology',
    location: 'San Francisco, USA',
    website: 'techsupply.com',
    confidence: 92,
    source: 'LinkedIn',
    scrapedAt: '2026-05-23T10:30:00',
    status: 'pending',
  },
  {
    id: '2',
    name: 'Global Manufacturing Ltd',
    industry: 'Manufacturing',
    location: 'Munich, Germany',
    website: 'globalmanuf.de',
    confidence: 88,
    source: 'Google Maps',
    scrapedAt: '2026-05-23T09:15:00',
    status: 'pending',
  },
  {
    id: '3',
    name: 'Asian Logistics Co.',
    industry: 'Logistics',
    location: 'Singapore',
    website: 'asianlogistics.sg',
    confidence: 95,
    source: 'Industry Directory',
    scrapedAt: '2026-05-23T08:45:00',
    status: 'pending',
  },
];

export function ScraperContent() {
  const [businesses, setBusinesses] = useState(MOCK_SCRAPED_BUSINESSES);

  const handleAction = (id: string, action: 'approve' | 'reject') => {
    setBusinesses((prev) => prev.map((b) => (b.id === id ? { ...b, status: action === 'approve' ? 'approved' : 'rejected' } : b)));
  };

  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/10">
            <Bot className="h-6 w-6 text-[hsl(var(--primary))]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">AI Scraper Dashboard</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Monitor scraping activity and review discovered businesses
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Activity}
          label="Currently Scanning"
          value={MOCK_SCRAPING_STATS.currentlyScanning}
          color="bg-blue-500/10 text-blue-500"
        />
        <StatCard
          icon={CheckCircle}
          label="Scanned Today"
          value={MOCK_SCRAPING_STATS.scannedToday}
          color="bg-emerald-500/10 text-emerald-500"
        />
        <StatCard
          icon={Database}
          label="Total Businesses"
          value={MOCK_SCRAPING_STATS.totalBusinesses}
          color="bg-violet-500/10 text-violet-500"
        />
        <StatCard
          icon={Clock}
          label="Pending Review"
          value={MOCK_SCRAPING_STATS.pendingReview}
          color="bg-amber-500/10 text-amber-500"
        />
      </div>

      {/* Active Scans */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-bold text-[hsl(var(--foreground))]">Active Scans</h2>
        <div className="space-y-3">
          {MOCK_ACTIVE_SCANS.map((scan) => (
            <div
              key={scan.id}
              className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/10">
                    <Zap className="h-4 w-4 text-[hsl(var(--primary))]" />
                  </div>
                  <div>
                    <p className="font-medium text-[hsl(var(--foreground))]">{scan.target}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Source: {scan.source}</p>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--primary))]">
                  <Activity className="h-4 w-4 animate-pulse" />
                  {scan.progress}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
                <div
                  className="h-full bg-[hsl(var(--primary))] transition-all duration-300"
                  style={{ width: `${scan.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Data Analytics Section */}
      <div className="mb-8">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-[hsl(var(--foreground))]">
          <BarChart3 className="h-5 w-5" />
          Data Analytics
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Top Source</p>
            <p className="mt-2 text-2xl font-bold text-[hsl(var(--foreground))]">LinkedIn</p>
            <p className="mt-1 text-xs text-emerald-500">+23% this week</p>
          </div>
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Avg. Confidence</p>
            <p className="mt-2 text-2xl font-bold text-[hsl(var(--foreground))]">89%</p>
            <p className="mt-1 text-xs text-emerald-500">+5% improvement</p>
          </div>
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Success Rate</p>
            <p className="mt-2 text-2xl font-bold text-[hsl(var(--foreground))]">94%</p>
            <p className="mt-1 text-xs text-emerald-500">Excellent</p>
          </div>
        </div>
      </div>

      {/* Scraped Businesses */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[hsl(var(--foreground))]">Recently Discovered Businesses</h2>
          <button className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))]">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
        <div className="space-y-4">
          {businesses.map((business) => (
            <div
              key={business.id}
              className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1 space-y-3">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-[hsl(var(--foreground))]">{business.name}</h3>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          business.status === 'approved'
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : business.status === 'rejected'
                              ? 'bg-red-500/10 text-red-500'
                              : 'bg-amber-500/10 text-amber-500'
                        }`}
                      >
                        {business.status === 'pending' ? 'Pending Review' : business.status}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-[hsl(var(--muted-foreground))]">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="h-4 w-4" />
                        {business.industry}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4" />
                        {business.location}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Globe className="h-4 w-4" />
                        {business.website}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">Confidence Score</p>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
                          <div
                            className="h-full bg-emerald-500"
                            style={{ width: `${business.confidence}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-emerald-500">{business.confidence}%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">Source</p>
                      <p className="mt-1 text-sm font-medium text-[hsl(var(--foreground))]">
                        {business.source}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">Discovered</p>
                      <p className="mt-1 text-sm font-medium text-[hsl(var(--foreground))]">
                        {new Date(business.scrapedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {business.status === 'pending' && (
                  <div className="flex gap-2 lg:flex-col lg:w-40">
                    <button
                      onClick={() => handleAction(business.id, 'approve')}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-600"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleAction(business.id, 'reject')}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-red-600"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{label}</p>
          <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{value.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
