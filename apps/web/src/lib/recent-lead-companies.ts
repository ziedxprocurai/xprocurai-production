'use client';

/**
 * Tracks recently viewed xDiscoveryBeta companies entirely client-side
 * (localStorage). Deliberately NOT persisted server-side: it's a pure UX
 * convenience and keeping it out of the database avoids extra Supabase
 * egress/writes for something that doesn't need durability.
 */

export interface RecentLeadCompany {
  id: number;
  name: string;
  domain?: string | null;
  city?: string | null;
  country?: string | null;
  viewedAt: number;
}

const STORAGE_KEY = 'xdiscoverybeta:recent-companies';
const MAX_RECENT = 10;

export function getRecentLeadCompanies(): RecentLeadCompany[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pushRecentLeadCompany(company: Omit<RecentLeadCompany, 'viewedAt'>): RecentLeadCompany[] {
  if (typeof window === 'undefined') return [];
  const existing = getRecentLeadCompanies().filter((c) => c.id !== company.id);
  const next = [{ ...company, viewedAt: Date.now() }, ...existing].slice(0, MAX_RECENT);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable (private mode / quota) — fail silently, this is best-effort UX only
  }
  return next;
}

export function clearRecentLeadCompanies() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
