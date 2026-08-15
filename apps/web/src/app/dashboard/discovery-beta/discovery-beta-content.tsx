'use client';

import { useEffect, useState, FormEvent, useCallback } from 'react';
import {
  Search,
  Users,
  Building2,
  Loader2,
  Mail,
  Phone,
  Linkedin,
  MapPin,
  Briefcase,
  X,
  Radar,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Send,
  CheckCircle,
  Clock,
  Trash2,
  Eye,
  Database,
  ShieldCheck,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';
import { getRecentLeadCompanies, pushRecentLeadCompany, type RecentLeadCompany } from '@/lib/recent-lead-companies';

type Tab = 'companies' | 'people';

interface LeadCompanyListItem {
  id: number;
  name: string;
  domain: string | null;
  sectorCode: string | null;
  sectorLabel: string | null;
  sizeRange: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  linkedinUrl: string | null;
  source: string;
  fetchedAt: string | null;
  _count: { emails: number; phones: number; persons: number };
}

interface LeadEmailContact {
  id: number;
  email: string;
  validationStatus?: string | null;
  confidenceScore?: number | null;
}

interface LeadPhoneContact {
  id: number;
  number: string;
  phoneType?: string | null;
}

interface LeadCompanyDetail extends LeadCompanyListItem {
  siren: string | null;
  siret: string | null;
  sourceDetail: string | null;
  persons: {
    id: number;
    fullName: string | null;
    firstName: string | null;
    lastName: string | null;
    jobTitle: string | null;
    linkedinUrl: string | null;
    emails: LeadEmailContact[];
    phones: LeadPhoneContact[];
  }[];
  emails: LeadEmailContact[];
  phones: LeadPhoneContact[];
}

interface LeadPersonListItem {
  id: number;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  linkedinUrl: string | null;
  source: string;
  fetchedAt: string | null;
  company: {
    id: number;
    name: string;
    domain: string | null;
    city: string | null;
    region: string | null;
    country: string | null;
    sectorLabel: string | null;
  } | null;
  emails: { id: number; email: string; validationStatus: string | null }[];
  phones: { id: number; number: string }[];
}

interface Facets {
  sectors: string[];
  regions: string[];
  sizeRanges: string[];
  countries: string[];
}

interface ContactResolution {
  loading?: boolean;
  error?: string;
  email?: string;
  phone?: string;
  contactName?: string;
}

const PAGE_SIZE = 20;
const MAX_SELECTION = 25;

const VALIDATION_META: Record<string, { label: string; color: string; icon: typeof ShieldCheck }> = {
  VALID: { label: 'Valid', color: 'text-emerald-500 bg-emerald-500/10', icon: ShieldCheck },
  RISKY: { label: 'Risky', color: 'text-amber-500 bg-amber-500/10', icon: ShieldAlert },
  GUESSED: { label: 'Guessed', color: 'text-amber-500 bg-amber-500/10', icon: AlertTriangle },
  WEBMAIL: { label: 'Webmail', color: 'text-blue-500 bg-blue-500/10', icon: Mail },
  DISPOSABLE: { label: 'Disposable', color: 'text-red-500 bg-red-500/10', icon: ShieldAlert },
  INVALID: { label: 'Invalid', color: 'text-red-500 bg-red-500/10', icon: ShieldAlert },
  UNKNOWN: { label: 'Unknown', color: 'text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))]', icon: AlertTriangle },
};

function formatEnumLabel(value?: string | null) {
  if (!value) return '—';
  return value
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function locationLabel(item: { city?: string | null; region?: string | null; country?: string | null }) {
  return [item.city, item.region, item.country].filter(Boolean).join(', ') || '—';
}

/** Picks the best available contact from a detailed lead company record. */
function pickBestContact(detail: LeadCompanyDetail): { email?: string; phone?: string; contactName?: string } {
  if (detail.emails[0]) return { email: detail.emails[0].email };
  if (detail.phones[0]) return { phone: detail.phones[0].number };
  for (const person of detail.persons) {
    if (person.emails[0]) return { email: person.emails[0].email, contactName: person.fullName || undefined };
    if (person.phones[0]) return { phone: person.phones[0].number, contactName: person.fullName || undefined };
  }
  return {};
}

export function DiscoveryBetaContent() {
  const [tab, setTab] = useState<Tab>('companies');
  const [showInfoPanel, setShowInfoPanel] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [facets, setFacets] = useState<Facets | null>(null);

  // Company filters
  const [keyword, setKeyword] = useState('');
  const [sectorLabel, setSectorLabel] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [country, setCountry] = useState('');
  const [sizeRange, setSizeRange] = useState('');
  const [hasEmail, setHasEmail] = useState(false);
  const [hasPhone, setHasPhone] = useState(false);
  const [hasLinkedin, setHasLinkedin] = useState(false);

  // Person filters
  const [personKeyword, setPersonKeyword] = useState('');
  const [personJobTitle, setPersonJobTitle] = useState('');
  const [personCompanyName, setPersonCompanyName] = useState('');
  const [personCity, setPersonCity] = useState('');
  const [personHasEmail, setPersonHasEmail] = useState(false);

  const [companies, setCompanies] = useState<LeadCompanyListItem[]>([]);
  const [persons, setPersons] = useState<LeadPersonListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectedMeta, setSelectedMeta] = useState<Record<number, LeadCompanyListItem>>({});
  const [contacts, setContacts] = useState<Record<number, ContactResolution>>({});

  const [viewingCompany, setViewingCompany] = useState<LeadCompanyDetail | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const [showRfqModal, setShowRfqModal] = useState(false);
  const [rfqTitle, setRfqTitle] = useState('');
  const [rfqDescription, setRfqDescription] = useState('');
  const [rfqQuantity, setRfqQuantity] = useState(1);
  const [submittingRfq, setSubmittingRfq] = useState(false);
  const [rfqError, setRfqError] = useState('');
  const [rfqSuccess, setRfqSuccess] = useState('');

  const [recentCompanies, setRecentCompanies] = useState<RecentLeadCompany[]>([]);

  useEffect(() => {
    setRecentCompanies(getRecentLeadCompanies());
    fetch('/api/leadgen/facets')
      .then((res) => res.json())
      .then((data) => setFacets(data))
      .catch(() => setFacets(null));
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function runCompanySearch(targetPage: number) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/leadgen/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: keyword || undefined,
          sectorLabel: sectorLabel || undefined,
          city: city || undefined,
          region: region || undefined,
          country: country || undefined,
          sizeRange: sizeRange || undefined,
          hasEmail: hasEmail || undefined,
          hasPhone: hasPhone || undefined,
          hasLinkedin: hasLinkedin || undefined,
          page: targetPage,
          pageSize: PAGE_SIZE,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to search companies');
      setCompanies(data.companies || []);
      setTotal(data.total ?? 0);
      setPage(targetPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to connect to the server');
      setCompanies([]);
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  }

  async function runPersonSearch(targetPage: number) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/leadgen/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: personKeyword || undefined,
          jobTitle: personJobTitle || undefined,
          companyName: personCompanyName || undefined,
          city: personCity || undefined,
          hasEmail: personHasEmail || undefined,
          page: targetPage,
          pageSize: PAGE_SIZE,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to search people');
      setPersons(data.persons || []);
      setTotal(data.total ?? 0);
      setPage(targetPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to connect to the server');
      setPersons([]);
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (tab === 'companies') runCompanySearch(1);
    else runPersonSearch(1);
  }

  function switchTab(next: Tab) {
    setTab(next);
    setError('');
    setHasSearched(false);
    setCompanies([]);
    setPersons([]);
    setTotal(0);
    setPage(1);
  }

  const resolveContact = useCallback(async (company: LeadCompanyListItem) => {
    setContacts((prev) => ({ ...prev, [company.id]: { loading: true } }));
    try {
      const res = await fetch(`/api/leadgen/companies/${company.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to load contact details');
      const best = pickBestContact(data as LeadCompanyDetail);
      if (!best.email && !best.phone) {
        setContacts((prev) => ({ ...prev, [company.id]: { error: 'No email or phone on file' } }));
        return;
      }
      setContacts((prev) => ({ ...prev, [company.id]: best }));
    } catch (err) {
      setContacts((prev) => ({
        ...prev,
        [company.id]: { error: err instanceof Error ? err.message : 'Failed to load contact details' },
      }));
    }
  }, []);

  function toggleSelect(company: LeadCompanyListItem) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(company.id)) {
        next.delete(company.id);
      } else {
        if (next.size >= MAX_SELECTION) {
          setError(`You can select up to ${MAX_SELECTION} companies per RFQ batch.`);
          return prev;
        }
        next.add(company.id);
        setSelectedMeta((meta) => ({ ...meta, [company.id]: company }));
        if (!contacts[company.id]) resolveContact(company);
      }
      return next;
    });
  }

  function removeFromSelection(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function openDetail(id: number) {
    setViewLoading(true);
    setViewingCompany(null);
    try {
      const res = await fetch(`/api/leadgen/companies/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to load company');
      setViewingCompany(data);
      const updated = pushRecentLeadCompany({
        id: data.id,
        name: data.name,
        domain: data.domain,
        city: data.city,
        country: data.country,
      });
      setRecentCompanies(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load company details');
    } finally {
      setViewLoading(false);
    }
  }

  function openRfqModal() {
    setRfqTitle(`RFQ for ${selectedIds.size} potential supplier${selectedIds.size === 1 ? '' : 's'}`);
    setRfqDescription('');
    setRfqQuantity(1);
    setRfqError('');
    setRfqSuccess('');
    setShowRfqModal(true);
  }

  async function submitRfq(e: FormEvent) {
    e.preventDefault();
    setSubmittingRfq(true);
    setRfqError('');
    const targets = Array.from(selectedIds);
    const stillLoading = targets.some((id) => contacts[id]?.loading);
    const missingContact = targets.some((id) => !contacts[id]?.email && !contacts[id]?.phone);
    if (stillLoading) {
      setRfqError('Please wait for contact details to finish loading.');
      setSubmittingRfq(false);
      return;
    }
    if (missingContact) {
      setRfqError('Remove companies without an email or phone on file before sending.');
      setSubmittingRfq(false);
      return;
    }

    // Shared across every company in this submission so RFQ Management can
    // regroup them into a single card, even when only one company is
    // selected (keeps the batch concept consistent regardless of count).
    const batchId = crypto.randomUUID();

    try {
      const results = await Promise.allSettled(
        targets.map((id) => {
          const company = selectedMeta[id];
          const contact = contacts[id];
          return fetch('/api/rfqs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: rfqTitle,
              description: rfqDescription,
              quantity: rfqQuantity,
              isExternal: true,
              leadCompanyId: id,
              externalCompanyName: company?.name,
              externalCompanyDomain: company?.domain,
              externalContactName: contact?.contactName,
              externalContactEmail: contact?.email,
              externalContactPhone: contact?.phone,
              sentVia: contact?.email ? 'EMAIL' : 'PHONE',
              batchId,
            }),
          }).then(async (res) => {
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data?.message || `Failed to send RFQ to ${company?.name}`);
            }
            return res.json();
          });
        }),
      );

      const failures = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
      const succeeded = results.length - failures.length;

      if (succeeded > 0) {
        setRfqSuccess(
          `Sent ${succeeded} RFQ${succeeded === 1 ? '' : 's'}${failures.length ? ` (${failures.length} failed)` : ''}. Check RFQ Management for details.`,
        );
        // Only clear the companies that actually succeeded from the selection.
        const failedNames = new Set(failures.map((f) => f.reason?.message));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          targets.forEach((id) => {
            const company = selectedMeta[id];
            if (!failedNames.has(`Failed to send RFQ to ${company?.name}`)) next.delete(id);
          });
          return next;
        });
        setTimeout(() => {
          setShowRfqModal(false);
          setRfqSuccess('');
        }, 2500);
      } else {
        setRfqError(failures[0]?.reason?.message || 'Failed to send RFQs');
      }
    } catch (err) {
      setRfqError(err instanceof Error ? err.message : 'Unable to connect to the server');
    } finally {
      setSubmittingRfq(false);
    }
  }

  const selectedList = Array.from(selectedIds);

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm">
              <Radar className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-[hsl(var(--foreground))]">
                X Discovery Beta
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-500">
                  BETA
                </span>
              </h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Search your own enriched lead database and request quotes directly
              </p>
            </div>
          </div>
        </div>

        {showInfoPanel && (
          <div className="relative rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
            <button
              onClick={() => setShowInfoPanel(false)}
              className="absolute right-3 top-3 rounded-lg p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
              <div className="space-y-1.5 pr-6">
                <p className="font-semibold text-[hsl(var(--foreground))]">Your own lead database</p>
                <p className="text-[hsl(var(--muted-foreground))]">
                  Unlike X Discovery (Apollo), results here come from companies and contacts already sourced into
                  your database (INSEE/RNE registries, Hunter.io, Google Places, website scrapes, and more). Select
                  companies below and request a quote — since these aren't onboarded suppliers yet, the RFQ is
                  logged against the email or phone number found for them and shows up in RFQ Management.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Recently viewed */}
        {recentCompanies.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))]">
              <Clock className="h-3.5 w-3.5" />
              Recently viewed:
            </span>
            {recentCompanies.map((c) => (
              <button
                key={c.id}
                onClick={() => openDetail(c.id)}
                className="shrink-0 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1 text-xs font-medium text-[hsl(var(--foreground))] transition-colors hover:border-[hsl(var(--primary))]"
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-1.5 w-fit">
          <button
            onClick={() => switchTab('companies')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'companies'
                ? 'bg-[hsl(var(--primary))] text-white shadow-sm'
                : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
            }`}
          >
            <Building2 className="h-4 w-4" />
            Companies
          </button>
          <button
            onClick={() => switchTab('people')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'people'
                ? 'bg-[hsl(var(--primary))] text-white shadow-sm'
                : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
            }`}
          >
            <Users className="h-4 w-4" />
            People
          </button>
        </div>

        {/* Search form */}
        <form onSubmit={handleSubmit} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-sm">
          {tab === 'companies' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Keyword (name, domain, sector)">
                <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g. logistics" className="input-field" />
              </Field>
              <Field label="Sector">
                <select value={sectorLabel} onChange={(e) => setSectorLabel(e.target.value)} className="input-field">
                  <option value="">Any sector</option>
                  {facets?.sectors.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="City">
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Tunis" className="input-field" />
              </Field>
              <Field label="Region">
                <select value={region} onChange={(e) => setRegion(e.target.value)} className="input-field">
                  <option value="">Any region</option>
                  {facets?.regions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </Field>

              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="col-span-full flex w-fit items-center gap-1.5 text-sm font-medium text-[hsl(var(--primary))]"
              >
                {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Advanced filters
              </button>

              {showAdvanced && (
                <>
                  <Field label="Country">
                    <select value={country} onChange={(e) => setCountry(e.target.value)} className="input-field">
                      <option value="">Any country</option>
                      {facets?.countries.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Company size">
                    <select value={sizeRange} onChange={(e) => setSizeRange(e.target.value)} className="input-field">
                      <option value="">Any size</option>
                      {facets?.sizeRanges.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="col-span-full flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-sm text-[hsl(var(--foreground))]">
                      <input type="checkbox" checked={hasEmail} onChange={(e) => setHasEmail(e.target.checked)} className="h-4 w-4 rounded border-[hsl(var(--border))]" />
                      Has email on file
                    </label>
                    <label className="flex items-center gap-2 text-sm text-[hsl(var(--foreground))]">
                      <input type="checkbox" checked={hasPhone} onChange={(e) => setHasPhone(e.target.checked)} className="h-4 w-4 rounded border-[hsl(var(--border))]" />
                      Has phone on file
                    </label>
                    <label className="flex items-center gap-2 text-sm text-[hsl(var(--foreground))]">
                      <input type="checkbox" checked={hasLinkedin} onChange={(e) => setHasLinkedin(e.target.checked)} className="h-4 w-4 rounded border-[hsl(var(--border))]" />
                      Has LinkedIn
                    </label>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Keyword (name, job title)">
                <input value={personKeyword} onChange={(e) => setPersonKeyword(e.target.value)} placeholder="e.g. procurement" className="input-field" />
              </Field>
              <Field label="Job title">
                <input value={personJobTitle} onChange={(e) => setPersonJobTitle(e.target.value)} placeholder="e.g. Purchasing Manager" className="input-field" />
              </Field>
              <Field label="Company name">
                <input value={personCompanyName} onChange={(e) => setPersonCompanyName(e.target.value)} placeholder="e.g. Acme SARL" className="input-field" />
              </Field>
              <Field label="City">
                <input value={personCity} onChange={(e) => setPersonCity(e.target.value)} placeholder="e.g. Sfax" className="input-field" />
              </Field>
              <label className="col-span-full flex w-fit items-center gap-2 text-sm text-[hsl(var(--foreground))]">
                <input type="checkbox" checked={personHasEmail} onChange={(e) => setPersonHasEmail(e.target.checked)} className="h-4 w-4 rounded border-[hsl(var(--border))]" />
                Has email on file
              </label>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
              <Database className="h-3.5 w-3.5" />
              Sourced from your enriched lead database.
            </p>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </button>
          </div>
        </form>

        {error && (
          <div className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
            <span>{error}</span>
            <button onClick={() => setError('')}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Searching your lead database...</p>
          </div>
        )}

        {/* Companies table */}
        {!loading && hasSearched && tab === 'companies' && (
          <>
            {companies.length === 0 ? (
              <EmptyState label="No companies found. Try adjusting your filters." />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 text-left text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                        <th className="w-10 px-4 py-3"></th>
                        <th className="px-4 py-3">Company</th>
                        <th className="px-4 py-3">Sector</th>
                        <th className="px-4 py-3">Location</th>
                        <th className="px-4 py-3">Size</th>
                        <th className="px-4 py-3">Contacts</th>
                        <th className="px-4 py-3">Source</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companies.map((company) => (
                        <tr
                          key={company.id}
                          className="border-b border-[hsl(var(--border))] last:border-0 hover:bg-[hsl(var(--muted))]/30"
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(company.id)}
                              onChange={() => toggleSelect(company)}
                              className="h-4 w-4 rounded border-[hsl(var(--border))]"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-[hsl(var(--foreground))]">{company.name}</div>
                            {company.domain && <div className="text-xs text-[hsl(var(--muted-foreground))]">{company.domain}</div>}
                          </td>
                          <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">{company.sectorLabel || '—'}</td>
                          <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                            <span className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 shrink-0" />
                              {locationLabel(company)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">{company.sizeRange || '—'}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
                              <span className={`flex items-center gap-1 ${company._count.emails ? 'text-[hsl(var(--foreground))]' : ''}`}>
                                <Mail className="h-3.5 w-3.5" />
                                {company._count.emails}
                              </span>
                              <span className={`flex items-center gap-1 ${company._count.phones ? 'text-[hsl(var(--foreground))]' : ''}`}>
                                <Phone className="h-3.5 w-3.5" />
                                {company._count.phones}
                              </span>
                              <span className={`flex items-center gap-1 ${company._count.persons ? 'text-[hsl(var(--foreground))]' : ''}`}>
                                <Users className="h-3.5 w-3.5" />
                                {company._count.persons}
                              </span>
                              {company.linkedinUrl && (
                                <a href={company.linkedinUrl} target="_blank" rel="noreferrer" className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                                  <Linkedin className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
                              {formatEnumLabel(company.source)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => openDetail(company.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] px-2.5 py-1.5 text-xs font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* People results */}
        {!loading && hasSearched && tab === 'people' && (
          <>
            {persons.length === 0 ? (
              <EmptyState label="No people found. Try adjusting your filters." />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {persons.map((person) => (
                  <div key={person.id} className="flex flex-col gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-sm transition-shadow hover:shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-[hsl(var(--foreground))]">{person.fullName || 'Unknown'}</p>
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">{person.jobTitle || '—'}</p>
                      </div>
                      {person.linkedinUrl && (
                        <a href={person.linkedinUrl} target="_blank" rel="noreferrer" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                          <Linkedin className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                      {person.company?.name && (
                        <span className="flex items-center gap-1.5">
                          <Briefcase className="h-3.5 w-3.5" />
                          {person.company.name}
                        </span>
                      )}
                      {person.company && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {locationLabel(person.company)}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 border-t border-[hsl(var(--border))] pt-3">
                      {person.emails[0] ? (
                        <span className="flex items-center gap-1.5 rounded-lg bg-[hsl(var(--muted))] px-2.5 py-1.5 text-xs text-[hsl(var(--foreground))]">
                          <Mail className="h-3.5 w-3.5" />
                          {person.emails[0].email}
                        </span>
                      ) : (
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">No email on file</span>
                      )}
                      {person.phones[0] && (
                        <span className="flex items-center gap-1.5 rounded-lg bg-[hsl(var(--muted))] px-2.5 py-1.5 text-xs text-[hsl(var(--foreground))]">
                          <Phone className="h-3.5 w-3.5" />
                          {person.phones[0].number}
                        </span>
                      )}
                      {person.company && (
                        <button
                          onClick={() => openDetail(person.company!.id)}
                          className="ml-auto text-xs font-medium text-[hsl(var(--primary))] hover:underline"
                        >
                          View company →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Pagination */}
        {!loading && hasSearched && ((tab === 'companies' && companies.length > 0) || (tab === 'people' && persons.length > 0)) && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              disabled={page <= 1}
              onClick={() => (tab === 'companies' ? runCompanySearch(page - 1) : runPersonSearch(page - 1))}
              className="rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-sm text-[hsl(var(--foreground))] disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-[hsl(var(--muted-foreground))]">
              Page {page} of {totalPages} · {total.toLocaleString()} results
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => (tab === 'companies' ? runCompanySearch(page + 1) : runPersonSearch(page + 1))}
              className="rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-sm text-[hsl(var(--foreground))] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}

        {!hasSearched && !loading && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[hsl(var(--border))] py-16 text-center">
            <Radar className="h-10 w-10 text-[hsl(var(--muted-foreground))]" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Enter your search criteria above to discover {tab === 'people' ? 'contacts' : 'companies'}.
            </p>
          </div>
        )}
      </div>

      {/* Sticky selection bar */}
      {tab === 'companies' && selectedIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-4 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-[hsl(var(--foreground))]">
              <CheckCircle className="h-4 w-4 text-[hsl(var(--primary))]" />
              <span className="font-medium">
                {selectedIds.size} compan{selectedIds.size === 1 ? 'y' : 'ies'} selected
              </span>
              <button onClick={() => setSelectedIds(new Set())} className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:underline">
                Clear
              </button>
            </div>
            <button
              onClick={openRfqModal}
              className="flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              <Send className="h-4 w-4" />
              Request Quote
            </button>
          </div>
        </div>
      )}

      {/* Company detail modal */}
      {(viewingCompany || viewLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setViewingCompany(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {viewLoading || !viewingCompany ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-[hsl(var(--foreground))]">{viewingCompany.name}</h2>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">{locationLabel(viewingCompany)}</p>
                  </div>
                  <button onClick={() => setViewingCompany(null)} className="rounded-lg p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <InfoItem label="Sector" value={viewingCompany.sectorLabel} />
                  <InfoItem label="Size" value={viewingCompany.sizeRange} />
                  <InfoItem label="Source" value={formatEnumLabel(viewingCompany.source)} />
                  <InfoItem label="SIREN" value={viewingCompany.siren} />
                  <InfoItem label="SIRET" value={viewingCompany.siret} />
                  <InfoItem label="Domain" value={viewingCompany.domain} />
                </div>

                {(viewingCompany.emails.length > 0 || viewingCompany.phones.length > 0) && (
                  <div className="mb-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                      General contacts
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {viewingCompany.emails.map((e) => (
                        <ContactChip key={`e-${e.id}`} icon={Mail} label={e.email} status={e.validationStatus} />
                      ))}
                      {viewingCompany.phones.map((p) => (
                        <ContactChip key={`p-${p.id}`} icon={Phone} label={p.number} />
                      ))}
                    </div>
                  </div>
                )}

                {viewingCompany.persons.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                      People ({viewingCompany.persons.length})
                    </p>
                    <div className="space-y-2">
                      {viewingCompany.persons.map((p) => (
                        <div key={p.id} className="rounded-lg border border-[hsl(var(--border))] p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-[hsl(var(--foreground))]">{p.fullName || 'Unknown'}</p>
                            {p.linkedinUrl && (
                              <a href={p.linkedinUrl} target="_blank" rel="noreferrer" className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                                <Linkedin className="h-4 w-4" />
                              </a>
                            )}
                          </div>
                          <p className="mb-2 text-xs text-[hsl(var(--muted-foreground))]">{p.jobTitle || '—'}</p>
                          <div className="flex flex-wrap gap-2">
                            {p.emails.map((e) => (
                              <ContactChip key={`e-${e.id}`} icon={Mail} label={e.email} status={e.validationStatus} />
                            ))}
                            {p.phones.map((ph) => (
                              <ContactChip key={`p-${ph.id}`} icon={Phone} label={ph.number} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* RFQ modal */}
      {showRfqModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[hsl(var(--foreground))]">Request a Quote</h2>
              <button onClick={() => setShowRfqModal(false)} className="rounded-lg p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-600 dark:text-amber-400">
              These companies aren't onboarded suppliers yet. The RFQ send is mocked using the best email/phone we
              found for them, and will appear in RFQ Management as an external lead.
            </div>

            <div className="mb-4 space-y-2">
              {selectedList.map((id) => {
                const company = selectedMeta[id];
                const contact = contacts[id];
                return (
                  <div key={id} className="flex items-center justify-between rounded-lg border border-[hsl(var(--border))] p-3">
                    <div>
                      <p className="text-sm font-medium text-[hsl(var(--foreground))]">{company?.name}</p>
                      {contact?.loading && (
                        <p className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                          <Loader2 className="h-3 w-3 animate-spin" /> Resolving contact...
                        </p>
                      )}
                      {contact?.error && <p className="text-xs text-red-500">{contact.error}</p>}
                      {(contact?.email || contact?.phone) && (
                        <p className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                          {contact.email ? <Mail className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
                          {contact.email || contact.phone}
                        </p>
                      )}
                    </div>
                    <button onClick={() => removeFromSelection(id)} className="rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-red-500/10 hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            <form onSubmit={submitRfq} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">RFQ Title *</label>
                <input required value={rfqTitle} onChange={(e) => setRfqTitle(e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">Description</label>
                <textarea value={rfqDescription} onChange={(e) => setRfqDescription(e.target.value)} rows={4} className="input-field" placeholder="Provide additional details about your requirements..." />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">Quantity *</label>
                <input type="number" required min={1} value={rfqQuantity} onChange={(e) => setRfqQuantity(parseInt(e.target.value) || 1)} className="input-field" />
              </div>

              {rfqError && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                  <p className="text-sm text-red-500">{rfqError}</p>
                </div>
              )}
              {rfqSuccess && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  <p className="text-sm font-medium text-emerald-500">{rfqSuccess}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowRfqModal(false)} className="flex-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRfq || selectedList.length === 0}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {submittingRfq ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send {selectedList.length} RFQ{selectedList.length === 1 ? '' : 's'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        .input-field {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--background));
          padding: 0.6rem 0.85rem;
          font-size: 0.875rem;
          color: hsl(var(--foreground));
          outline: none;
          transition: border-color 0.15s ease;
        }
        .input-field:focus {
          border-color: hsl(var(--primary));
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">{label}</span>
      {children}
    </label>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] py-16 text-center">
      <p className="text-sm text-[hsl(var(--muted-foreground))]">{label}</p>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
      <p className="text-sm font-medium text-[hsl(var(--foreground))]">{value || '—'}</p>
    </div>
  );
}

function ContactChip({ icon: Icon, label, status }: { icon: typeof Mail; label: string; status?: string | null }) {
  const meta = status ? VALIDATION_META[status] : undefined;
  return (
    <span className="flex items-center gap-1.5 rounded-lg bg-[hsl(var(--muted))] px-2.5 py-1.5 text-xs text-[hsl(var(--foreground))]">
      <Icon className="h-3.5 w-3.5" />
      {label}
      {meta && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${meta.color}`}>{meta.label}</span>}
    </span>
  );
}
