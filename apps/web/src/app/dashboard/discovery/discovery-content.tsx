'use client';

import { useState, FormEvent } from 'react';
import {
  Search,
  Users,
  Building2,
  Loader2,
  Mail,
  Linkedin,
  MapPin,
  Briefcase,
  ExternalLink,
  Globe,
  Info,
  X,
  Compass,
} from 'lucide-react';

type Tab = 'people' | 'companies';

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
  city?: string;
  state?: string;
  country?: string;
  linkedin_url?: string;
  short_description?: string;
}

const PAGE_SIZE = 10;

export function DiscoveryContent() {
  const [tab, setTab] = useState<Tab>('people');

  // People filters
  const [personKeywords, setPersonKeywords] = useState('');
  const [personTitles, setPersonTitles] = useState('');
  const [personLocations, setPersonLocations] = useState('');
  const [orgDomain, setOrgDomain] = useState('');

  // Company filters
  const [companyName, setCompanyName] = useState('');
  const [companyLocations, setCompanyLocations] = useState('');
  const [companyKeywords, setCompanyKeywords] = useState('');
  const [employeeRange, setEmployeeRange] = useState('');

  const [people, setPeople] = useState<ApolloPerson[]>([]);
  const [companies, setCompanies] = useState<ApolloCompany[]>([]);
  const [totalResults, setTotalResults] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  function splitList(value: string): string[] | undefined {
    const items = value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    return items.length ? items : undefined;
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
          person_locations: splitList(personLocations),
          q_organization_domains_list: splitList(orgDomain),
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
          q_organization_keyword_tags: splitList(companyKeywords),
          organization_num_employees_ranges: splitList(employeeRange),
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
  }

  function locationLabel(item: { city?: string; state?: string; country?: string }) {
    return [item.city, item.state, item.country].filter(Boolean).join(', ') || '—';
  }

  const totalPages = totalResults ? Math.max(1, Math.ceil(totalResults / PAGE_SIZE)) : 1;

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
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
        </div>

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
                    {person.email && (
                      <span className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        {person.email}
                      </span>
                    )}
                  </div>
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
                  </div>
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
