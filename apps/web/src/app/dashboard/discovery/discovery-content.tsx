'use client';

import { useState, useEffect, FormEvent } from 'react';
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
  ExternalLink,
  Globe,
  Info,
  X,
  Compass,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Zap,
  DollarSign,
  Cpu,
} from 'lucide-react';

type Tab = 'people' | 'companies';

const SENIORITIES = ['owner', 'founder', 'c_suite', 'partner', 'vp', 'head', 'director', 'manager', 'senior', 'entry', 'intern'];
const EMAIL_STATUSES = ['verified', 'unverified', 'likely to engage', 'unavailable'];

interface ApolloPerson {
  id: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  title?: string;
  linkedin_url?: string;
  email?: string;
  city?: string;
  state?: string;
  country?: string;
  organization?: {
    name?: string;
    website_url?: string;
    industry?: string;
  };
}

interface ApolloCompany {
  id: string;
  name?: string;
  website_url?: string;
  industry?: string;
  estimated_num_employees?: number;
  annual_revenue?: number;
  city?: string;
  state?: string;
  country?: string;
  linkedin_url?: string;
  short_description?: string;
  current_technologies?: { name: string }[];
}

interface EnrichedPersonState {
  email?: string;
  emailLoading?: boolean;
  emailError?: string;
  phoneStatus?: 'pending' | 'success' | 'error';
  phoneNumbers?: string[];
  phoneError?: string;
}

interface UsageStats {
  available: boolean;
  [key: string]: unknown;
}

const PAGE_SIZE = 10;
const PHONE_POLL_INTERVAL_MS = 4000;
const PHONE_POLL_MAX_ATTEMPTS = 10;

export function DiscoveryContent() {
  const [tab, setTab] = useState<Tab>('people');
  const [showInfoPanel, setShowInfoPanel] = useState(true);
  const [showPersonAdvanced, setShowPersonAdvanced] = useState(false);
  const [showCompanyAdvanced, setShowCompanyAdvanced] = useState(false);

  // People filters
  const [personKeywords, setPersonKeywords] = useState('');
  const [personTitles, setPersonTitles] = useState('');
  const [includeSimilarTitles, setIncludeSimilarTitles] = useState(true);
  const [personLocations, setPersonLocations] = useState('');
  const [orgDomain, setOrgDomain] = useState('');
  const [seniorities, setSeniorities] = useState<string[]>([]);
  const [emailStatuses, setEmailStatuses] = useState<string[]>([]);
  const [personEmployeeRange, setPersonEmployeeRange] = useState('');
  const [personTechnologies, setPersonTechnologies] = useState('');
  const [personRevenueMin, setPersonRevenueMin] = useState('');
  const [personRevenueMax, setPersonRevenueMax] = useState('');

  // Company filters
  const [companyName, setCompanyName] = useState('');
  const [companyLocations, setCompanyLocations] = useState('');
  const [companyNotLocations, setCompanyNotLocations] = useState('');
  const [companyKeywords, setCompanyKeywords] = useState('');
  const [employeeRange, setEmployeeRange] = useState('');
  const [companyTechnologies, setCompanyTechnologies] = useState('');
  const [companyRevenueMin, setCompanyRevenueMin] = useState('');
  const [companyRevenueMax, setCompanyRevenueMax] = useState('');
  const [fundingMin, setFundingMin] = useState('');
  const [fundingMax, setFundingMax] = useState('');
  const [jobTitles, setJobTitles] = useState('');
  const [jobLocations, setJobLocations] = useState('');

  const [people, setPeople] = useState<ApolloPerson[]>([]);
  const [companies, setCompanies] = useState<ApolloCompany[]>([]);
  const [totalResults, setTotalResults] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [enriched, setEnriched] = useState<Record<string, EnrichedPersonState>>({});
  const [usage, setUsage] = useState<UsageStats | null>(null);

  useEffect(() => {
    fetch('/api/discovery/usage')
      .then((res) => res.json())
      .then((data) => setUsage(data))
      .catch(() => setUsage({ available: false }));
  }, []);

  function splitList(value: string): string[] | undefined {
    const items = value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    return items.length ? items : undefined;
  }

  function toggleFromArray(list: string[], value: string, setList: (next: string[]) => void) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function runPeopleSearch(targetPage: number) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/discovery/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q_keywords: personKeywords || undefined,
          person_titles: splitList(personTitles),
          include_similar_titles: includeSimilarTitles,
          person_locations: splitList(personLocations),
          person_seniorities: seniorities.length ? seniorities : undefined,
          contact_email_status: emailStatuses.length ? emailStatuses : undefined,
          q_organization_domains_list: splitList(orgDomain),
          organization_num_employees_ranges: splitList(personEmployeeRange),
          currently_using_any_of_technology_uids: splitList(personTechnologies),
          'revenue_range[min]': personRevenueMin ? Number(personRevenueMin) : undefined,
          'revenue_range[max]': personRevenueMax ? Number(personRevenueMax) : undefined,
          page: targetPage,
          per_page: PAGE_SIZE,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || 'Failed to search people');
      }
      setPeople(data.people || []);
      setTotalResults(data.pagination?.total_entries ?? null);
      setPage(targetPage);
      setEnriched({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to connect to the server');
      setPeople([]);
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  }

  async function runCompanySearch(targetPage: number) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/discovery/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q_organization_name: companyName || undefined,
          organization_locations: splitList(companyLocations),
          organization_not_locations: splitList(companyNotLocations),
          q_organization_keyword_tags: splitList(companyKeywords),
          organization_num_employees_ranges: splitList(employeeRange),
          currently_using_any_of_technology_uids: splitList(companyTechnologies),
          'revenue_range[min]': companyRevenueMin ? Number(companyRevenueMin) : undefined,
          'revenue_range[max]': companyRevenueMax ? Number(companyRevenueMax) : undefined,
          'total_funding_range[min]': fundingMin ? Number(fundingMin) : undefined,
          'total_funding_range[max]': fundingMax ? Number(fundingMax) : undefined,
          q_organization_job_titles: splitList(jobTitles),
          organization_job_locations: splitList(jobLocations),
          page: targetPage,
          per_page: PAGE_SIZE,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || 'Failed to search companies');
      }
      setCompanies(data.organizations || []);
      setTotalResults(data.pagination?.total_entries ?? null);
      setPage(targetPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to connect to the server');
      setCompanies([]);
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (tab === 'people') {
      runPeopleSearch(1);
    } else {
      runCompanySearch(1);
    }
  }

  function switchTab(next: Tab) {
    setTab(next);
    setError('');
    setHasSearched(false);
    setPeople([]);
    setCompanies([]);
    setTotalResults(null);
    setPage(1);
    setEnriched({});
  }

  function locationLabel(item: { city?: string; state?: string; country?: string }) {
    return [item.city, item.state, item.country].filter(Boolean).join(', ') || '—';
  }

  async function handleGetEmail(person: ApolloPerson) {
    setEnriched((prev) => ({ ...prev, [person.id]: { ...prev[person.id], emailLoading: true, emailError: undefined } }));
    try {
      const res = await fetch('/api/discovery/people/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: person.id, revealEmail: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to reveal email');
      const email = data?.person?.email || data?.email;
      setEnriched((prev) => ({
        ...prev,
        [person.id]: { ...prev[person.id], emailLoading: false, email: email || undefined, emailError: email ? undefined : 'No email available' },
      }));
    } catch (err) {
      setEnriched((prev) => ({
        ...prev,
        [person.id]: { ...prev[person.id], emailLoading: false, emailError: err instanceof Error ? err.message : 'Failed to reveal email' },
      }));
    }
  }

  async function handleGetPhone(person: ApolloPerson) {
    setEnriched((prev) => ({ ...prev, [person.id]: { ...prev[person.id], phoneStatus: 'pending', phoneError: undefined } }));
    try {
      const res = await fetch('/api/discovery/people/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: person.id, revealPhone: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to request phone number');
      const token = data?.phoneRevealToken;
      if (!token) throw new Error('No reveal token returned');
      pollPhoneStatus(person.id, token, 0);
    } catch (err) {
      setEnriched((prev) => ({
        ...prev,
        [person.id]: { ...prev[person.id], phoneStatus: 'error', phoneError: err instanceof Error ? err.message : 'Failed to request phone number' },
      }));
    }
  }

  function pollPhoneStatus(personId: string, token: string, attempt: number) {
    if (attempt >= PHONE_POLL_MAX_ATTEMPTS) {
      setEnriched((prev) => ({
        ...prev,
        [personId]: { ...prev[personId], phoneStatus: 'error', phoneError: 'Timed out waiting for Apollo webhook' },
      }));
      return;
    }
    setTimeout(async () => {
      try {
        const res = await fetch(`/api/discovery/people/phone-status?token=${token}`);
        const data = await res.json();
        if (data.status === 'success') {
          setEnriched((prev) => ({
            ...prev,
            [personId]: { ...prev[personId], phoneStatus: 'success', phoneNumbers: (data.phoneNumbers || []).map((p: any) => p.raw_number || p.sanitized_number).filter(Boolean) },
          }));
        } else if (data.status === 'error') {
          setEnriched((prev) => ({
            ...prev,
            [personId]: { ...prev[personId], phoneStatus: 'error', phoneError: data.error || 'No phone number found' },
          }));
        } else {
          pollPhoneStatus(personId, token, attempt + 1);
        }
      } catch {
        pollPhoneStatus(personId, token, attempt + 1);
      }
    }, PHONE_POLL_INTERVAL_MS);
  }

  const totalPages = totalResults ? Math.max(1, Math.ceil(totalResults / PAGE_SIZE)) : 1;

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm">
              <Compass className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">X Discovery</h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Find prospects and companies powered by Apollo.io
              </p>
            </div>
          </div>
          {usage?.available && (
            <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2 text-sm">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="text-[hsl(var(--muted-foreground))]">Apollo API usage available in your workspace</span>
            </div>
          )}
        </div>

        {/* Feature-parity info panel */}
        {showInfoPanel && (
          <div className="relative rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
            <button
              onClick={() => setShowInfoPanel(false)}
              className="absolute right-3 top-3 rounded-lg p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <div className="space-y-1.5 pr-6">
                <p className="font-semibold text-[hsl(var(--foreground))]">What this covers vs. the Apollo app</p>
                <p className="text-[hsl(var(--muted-foreground))]">
                  Every filter below maps to a documented Apollo API parameter (job titles, seniority, locations,
                  employee/revenue ranges, technologies, email status, job postings, funding). "Get email" / "Get
                  phone" use the real People Enrichment endpoint, including async phone-number webhooks.
                </p>
                <p className="text-[hsl(var(--muted-foreground))]">
                  <strong className="text-[hsl(var(--foreground))]">Not reproducible via the public API</strong> —
                  these Apollo app features have no documented REST endpoint, so they can't be built here:{' '}
                  <em>AI Filters / Research with AI</em> (internal ML query builder), <em>People &amp; Company
                  Lookalikes</em> (proprietary similarity model), <em>Buying Intent</em> scores/topics (separate
                  premium intent-data product), <em>SIC &amp; NAICS codes, Market Segments, Website Visitors</em>{' '}
                  (app-only filters), and <em>Lists / Saved Searches / Workflows / Sequences</em> (CRM features tied
                  to your own Apollo seat, not the search API).
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-1.5 w-fit">
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
        </div>

        {/* Search form */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-sm"
        >
          {tab === 'people' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Keywords">
                <input
                  value={personKeywords}
                  onChange={(e) => setPersonKeywords(e.target.value)}
                  placeholder="e.g. procurement manager"
                  className="input-field"
                />
              </Field>
              <Field label="Job titles (comma separated)">
                <input
                  value={personTitles}
                  onChange={(e) => setPersonTitles(e.target.value)}
                  placeholder="CEO, Founder, VP Sales"
                  className="input-field"
                />
              </Field>
              <Field label="Locations (comma separated)">
                <input
                  value={personLocations}
                  onChange={(e) => setPersonLocations(e.target.value)}
                  placeholder="United States, Germany"
                  className="input-field"
                />
              </Field>
              <Field label="Company domain(s)">
                <input
                  value={orgDomain}
                  onChange={(e) => setOrgDomain(e.target.value)}
                  placeholder="apollo.io, acme.com"
                  className="input-field"
                />
              </Field>

              <label className="col-span-full flex w-fit items-center gap-2 text-sm text-[hsl(var(--foreground))]">
                <input
                  type="checkbox"
                  checked={includeSimilarTitles}
                  onChange={(e) => setIncludeSimilarTitles(e.target.checked)}
                  className="h-4 w-4 rounded border-[hsl(var(--border))]"
                />
                Include people with similar job titles
              </label>

              <button
                type="button"
                onClick={() => setShowPersonAdvanced((v) => !v)}
                className="col-span-full flex w-fit items-center gap-1.5 text-sm font-medium text-[hsl(var(--primary))]"
              >
                {showPersonAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Advanced filters
              </button>

              {showPersonAdvanced && (
                <>
                  <div className="col-span-full">
                    <span className="mb-2 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Seniority</span>
                    <div className="flex flex-wrap gap-2">
                      {SENIORITIES.map((s) => (
                        <button
                          type="button"
                          key={s}
                          onClick={() => toggleFromArray(seniorities, s, setSeniorities)}
                          className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
                            seniorities.includes(s)
                              ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white'
                              : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                          }`}
                        >
                          {s.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="col-span-full">
                    <span className="mb-2 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Email status</span>
                    <div className="flex flex-wrap gap-2">
                      {EMAIL_STATUSES.map((s) => (
                        <button
                          type="button"
                          key={s}
                          onClick={() => toggleFromArray(emailStatuses, s, setEmailStatuses)}
                          className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
                            emailStatuses.includes(s)
                              ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white'
                              : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Field label="Employer size (e.g. 1,10)">
                    <input
                      value={personEmployeeRange}
                      onChange={(e) => setPersonEmployeeRange(e.target.value)}
                      placeholder="1,10, 250,500"
                      className="input-field"
                    />
                  </Field>
                  <Field label="Employer technologies">
                    <input
                      value={personTechnologies}
                      onChange={(e) => setPersonTechnologies(e.target.value)}
                      placeholder="salesforce, wordpress_org"
                      className="input-field"
                    />
                  </Field>
                  <Field label="Employer revenue min ($)">
                    <input
                      type="number"
                      value={personRevenueMin}
                      onChange={(e) => setPersonRevenueMin(e.target.value)}
                      placeholder="500000"
                      className="input-field"
                    />
                  </Field>
                  <Field label="Employer revenue max ($)">
                    <input
                      type="number"
                      value={personRevenueMax}
                      onChange={(e) => setPersonRevenueMax(e.target.value)}
                      placeholder="50000000"
                      className="input-field"
                    />
                  </Field>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Company name">
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className="input-field"
                />
              </Field>
              <Field label="Locations (comma separated)">
                <input
                  value={companyLocations}
                  onChange={(e) => setCompanyLocations(e.target.value)}
                  placeholder="texas, tokyo, spain"
                  className="input-field"
                />
              </Field>
              <Field label="Keywords / industry">
                <input
                  value={companyKeywords}
                  onChange={(e) => setCompanyKeywords(e.target.value)}
                  placeholder="mining, consulting"
                  className="input-field"
                />
              </Field>
              <Field label="Employee range (e.g. 10,50)">
                <input
                  value={employeeRange}
                  onChange={(e) => setEmployeeRange(e.target.value)}
                  placeholder="1,10, 250,500"
                  className="input-field"
                />
              </Field>

              <button
                type="button"
                onClick={() => setShowCompanyAdvanced((v) => !v)}
                className="col-span-full flex w-fit items-center gap-1.5 text-sm font-medium text-[hsl(var(--primary))]"
              >
                {showCompanyAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Advanced filters
              </button>

              {showCompanyAdvanced && (
                <>
                  <Field label="Exclude locations">
                    <input
                      value={companyNotLocations}
                      onChange={(e) => setCompanyNotLocations(e.target.value)}
                      placeholder="ireland, seoul"
                      className="input-field"
                    />
                  </Field>
                  <Field label="Technologies used">
                    <input
                      value={companyTechnologies}
                      onChange={(e) => setCompanyTechnologies(e.target.value)}
                      placeholder="salesforce, google_analytics"
                      className="input-field"
                    />
                  </Field>
                  <Field label="Revenue min ($)">
                    <input
                      type="number"
                      value={companyRevenueMin}
                      onChange={(e) => setCompanyRevenueMin(e.target.value)}
                      placeholder="300000"
                      className="input-field"
                    />
                  </Field>
                  <Field label="Revenue max ($)">
                    <input
                      type="number"
                      value={companyRevenueMax}
                      onChange={(e) => setCompanyRevenueMax(e.target.value)}
                      placeholder="50000000"
                      className="input-field"
                    />
                  </Field>
                  <Field label="Total funding min ($)">
                    <input
                      type="number"
                      value={fundingMin}
                      onChange={(e) => setFundingMin(e.target.value)}
                      placeholder="5000000"
                      className="input-field"
                    />
                  </Field>
                  <Field label="Total funding max ($)">
                    <input
                      type="number"
                      value={fundingMax}
                      onChange={(e) => setFundingMax(e.target.value)}
                      placeholder="350000000"
                      className="input-field"
                    />
                  </Field>
                  <Field label="Active job posting titles">
                    <input
                      value={jobTitles}
                      onChange={(e) => setJobTitles(e.target.value)}
                      placeholder="sales manager, research analyst"
                      className="input-field"
                    />
                  </Field>
                  <Field label="Job posting locations">
                    <input
                      value={jobLocations}
                      onChange={(e) => setJobLocations(e.target.value)}
                      placeholder="atlanta, japan"
                      className="input-field"
                    />
                  </Field>
                </>
              )}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
              <Info className="h-3.5 w-3.5" />
              Data provided by Apollo.io. Results are limited to what your organization's Apollo plan allows.
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

        {/* Error */}
        {error && (
          <div className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
            <span>{error}</span>
            <button onClick={() => setError('')}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Results */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Searching Apollo...</p>
          </div>
        )}

        {!loading && hasSearched && tab === 'people' && (
          <ResultsWrapper
            count={people.length}
            totalResults={totalResults}
            emptyLabel="No people found. Try adjusting your filters."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {people.map((person) => (
                <div
                  key={person.id}
                  className="flex flex-col gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[hsl(var(--foreground))]">
                        {person.name || `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim() || 'Unknown'}
                      </p>
                      <p className="text-sm text-[hsl(var(--muted-foreground))]">{person.title || '—'}</p>
                    </div>
                    {person.linkedin_url && (
                      <a
                        href={person.linkedin_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                      >
                        <Linkedin className="h-4 w-4" />
                      </a>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                    {person.organization?.name && (
                      <span className="flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5" />
                        {person.organization.name}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {locationLabel(person)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-[hsl(var(--border))] pt-3">
                    {enriched[person.id]?.email ? (
                      <span className="flex items-center gap-1.5 rounded-lg bg-[hsl(var(--muted))] px-2.5 py-1.5 text-xs text-[hsl(var(--foreground))]">
                        <Mail className="h-3.5 w-3.5" />
                        {enriched[person.id].email}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleGetEmail(person)}
                        disabled={enriched[person.id]?.emailLoading}
                        className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] px-2.5 py-1.5 text-xs font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-60"
                      >
                        {enriched[person.id]?.emailLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Mail className="h-3.5 w-3.5" />
                        )}
                        Get email
                      </button>
                    )}

                    {enriched[person.id]?.phoneStatus === 'success' ? (
                      <span className="flex items-center gap-1.5 rounded-lg bg-[hsl(var(--muted))] px-2.5 py-1.5 text-xs text-[hsl(var(--foreground))]">
                        <Phone className="h-3.5 w-3.5" />
                        {enriched[person.id].phoneNumbers?.[0] || 'No number'}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleGetPhone(person)}
                        disabled={enriched[person.id]?.phoneStatus === 'pending'}
                        className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] px-2.5 py-1.5 text-xs font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-60"
                      >
                        {enriched[person.id]?.phoneStatus === 'pending' ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Phone className="h-3.5 w-3.5" />
                        )}
                        {enriched[person.id]?.phoneStatus === 'pending' ? 'Waiting for Apollo...' : 'Get phone'}
                      </button>
                    )}
                  </div>
                  {(enriched[person.id]?.emailError || enriched[person.id]?.phoneError) && (
                    <p className="text-xs text-red-500">
                      {enriched[person.id]?.emailError || enriched[person.id]?.phoneError}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </ResultsWrapper>
        )}

        {!loading && hasSearched && tab === 'companies' && (
          <ResultsWrapper
            count={companies.length}
            totalResults={totalResults}
            emptyLabel="No companies found. Try adjusting your filters."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {companies.map((company) => (
                <div
                  key={company.id}
                  className="flex flex-col gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[hsl(var(--foreground))]">{company.name || 'Unknown'}</p>
                      <p className="text-sm text-[hsl(var(--muted-foreground))]">{company.industry || '—'}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {company.linkedin_url && (
                        <a
                          href={company.linkedin_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                        >
                          <Linkedin className="h-4 w-4" />
                        </a>
                      )}
                      {company.website_url && (
                        <a
                          href={company.website_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>

                  {company.short_description && (
                    <p className="line-clamp-2 text-sm text-[hsl(var(--muted-foreground))]">
                      {company.short_description}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {locationLabel(company)}
                    </span>
                    {typeof company.estimated_num_employees === 'number' && (
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        {company.estimated_num_employees.toLocaleString()} employees
                      </span>
                    )}
                    {company.website_url && (
                      <span className="flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5" />
                        {company.website_url.replace(/^https?:\/\//, '')}
                      </span>
                    )}
                    {typeof company.annual_revenue === 'number' && (
                      <span className="flex items-center gap-1.5">
                        <DollarSign className="h-3.5 w-3.5" />
                        ${company.annual_revenue.toLocaleString()} revenue
                      </span>
                    )}
                  </div>

                  {!!company.current_technologies?.length && (
                    <div className="flex flex-wrap items-center gap-1.5 border-t border-[hsl(var(--border))] pt-3">
                      <Cpu className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                      {company.current_technologies.slice(0, 6).map((tech) => (
                        <span
                          key={tech.name}
                          className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-[11px] text-[hsl(var(--muted-foreground))]"
                        >
                          {tech.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ResultsWrapper>
        )}

        {/* Pagination */}
        {!loading && hasSearched && ((tab === 'people' && people.length > 0) || (tab === 'companies' && companies.length > 0)) && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              disabled={page <= 1}
              onClick={() => (tab === 'people' ? runPeopleSearch(page - 1) : runCompanySearch(page - 1))}
              className="rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-sm text-[hsl(var(--foreground))] disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-[hsl(var(--muted-foreground))]">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => (tab === 'people' ? runPeopleSearch(page + 1) : runCompanySearch(page + 1))}
              className="rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-sm text-[hsl(var(--foreground))] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}

        {!hasSearched && !loading && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[hsl(var(--border))] py-16 text-center">
            <Compass className="h-10 w-10 text-[hsl(var(--muted-foreground))]" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Enter your search criteria above to discover {tab === 'people' ? 'prospects' : 'companies'}.
            </p>
          </div>
        )}
      </div>

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

function ResultsWrapper({
  count,
  totalResults,
  emptyLabel,
  children,
}: {
  count: number;
  totalResults: number | null;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  if (count === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[hsl(var(--border))] py-16 text-center">
        <Search className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {totalResults !== null && (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {totalResults.toLocaleString()} total result{totalResults === 1 ? '' : 's'} found
        </p>
      )}
      {children}
    </div>
  );
}
