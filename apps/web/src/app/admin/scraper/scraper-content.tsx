'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Bot,
  Globe,
  Loader2,
  Mail,
  Phone,
  CheckCircle,
  XCircle,
  Trash2,
  AlertCircle,
  ShieldCheck,
  Search,
  Clock,
  FileWarning,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';

interface ScrapedContact {
  id: string;
  type: 'EMAIL' | 'PHONE';
  value: string;
  pageUrl: string;
  credibility: string;
  score: number;
  deliverability: string | null;
  reviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

interface ScraperJob {
  id: string;
  targetUrl: string;
  companyName: string | null;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  maxPages: number;
  verifyContacts: boolean;
  smtpVerify: boolean;
  pagesCrawled: number;
  pagesFailed: number;
  emailsFound: number;
  phonesFound: number;
  errorMessage: string | null;
  contacts?: ScrapedContact[];
  _count?: { contacts: number };
  createdAt: string;
}

const CREDIBILITY_STYLES: Record<string, string> = {
  high: 'bg-emerald-500/10 text-emerald-500',
  medium: 'bg-amber-500/10 text-amber-500',
  low: 'bg-orange-500/10 text-orange-500',
  rejected: 'bg-red-500/10 text-red-500',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ScraperContent() {
  const [jobs, setJobs] = useState<ScraperJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [selectedJob, setSelectedJob] = useState<ScraperJob | null>(null);
  const [loadingJob, setLoadingJob] = useState(false);

  const [targetUrl, setTargetUrl] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [maxPages, setMaxPages] = useState(5);
  const [verifyContacts, setVerifyContacts] = useState(true);
  const [smtpVerify, setSmtpVerify] = useState(false);
  const [sameDomainOnly, setSameDomainOnly] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/scraper/jobs');
      if (res.ok) setJobs(await res.json());
    } catch {
      // silently ignore
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  async function loadJob(id: string) {
    setLoadingJob(true);
    try {
      const res = await fetch(`/api/admin/scraper/jobs/${id}`);
      if (res.ok) setSelectedJob(await res.json());
    } finally {
      setLoadingJob(false);
    }
  }

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (!targetUrl.trim()) return;

    setScanning(true);
    setScanError('');
    setSelectedJob(null);

    try {
      const res = await fetch('/api/admin/scraper/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl: targetUrl.trim(),
          companyName: companyName.trim() || undefined,
          maxPages,
          verifyContacts,
          smtpVerify,
          sameDomainOnly,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setScanError(data?.message || 'Scan failed. Please try again.');
        if (data?.job) await fetchJobs();
        return;
      }

      setSelectedJob(data);
      setTargetUrl('');
      setCompanyName('');
      await fetchJobs();
    } catch {
      setScanError('Scan failed. Please check your connection and try again.');
    } finally {
      setScanning(false);
    }
  }

  async function handleReview(contactId: string, reviewStatus: 'APPROVED' | 'REJECTED') {
    if (!selectedJob) return;
    setSelectedJob((prev) =>
      prev
        ? {
            ...prev,
            contacts: prev.contacts?.map((c) => (c.id === contactId ? { ...c, reviewStatus } : c)),
          }
        : prev,
    );
    await fetch(`/api/admin/scraper/contacts/${contactId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewStatus }),
    });
  }

  async function handleDeleteJob(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/scraper/jobs/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setJobs((prev) => prev.filter((j) => j.id !== id));
        if (selectedJob?.id === id) setSelectedJob(null);
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/10">
            <Bot className="h-6 w-6 text-[hsl(var(--primary))]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">AI Scraper</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Crawl a company website and verify its emails &amp; phone numbers with credibility scoring
            </p>
          </div>
        </div>
      </div>

      {/* New Scan Form */}
      <form
        onSubmit={handleScan}
        className="mb-8 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm"
      >
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-[hsl(var(--foreground))]">
          <Search className="h-4 w-4 text-[hsl(var(--primary))]" />
          Start a New Scan
        </h2>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              Target Website
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2.5">
              <Globe className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
              <input
                type="text"
                required
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="e.g. supplier-company.com"
                className="w-full bg-transparent text-sm text-[hsl(var(--foreground))] outline-none placeholder:text-[hsl(var(--muted-foreground))]/60"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              Company Name (optional)
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Tunis Office Solutions"
              className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2.5 text-sm text-[hsl(var(--foreground))] outline-none placeholder:text-[hsl(var(--muted-foreground))]/60"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              Max Pages
            </label>
            <input
              type="number"
              min={1}
              max={15}
              value={maxPages}
              onChange={(e) => setMaxPages(Math.min(15, Math.max(1, parseInt(e.target.value, 10) || 1)))}
              className="w-16 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1.5 text-sm text-[hsl(var(--foreground))] outline-none"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-[hsl(var(--foreground))]">
            <input
              type="checkbox"
              checked={sameDomainOnly}
              onChange={(e) => setSameDomainOnly(e.target.checked)}
              className="h-4 w-4 rounded border-[hsl(var(--border))] accent-[hsl(var(--primary))]"
            />
            Same domain only
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-[hsl(var(--foreground))]">
            <input
              type="checkbox"
              checked={verifyContacts}
              onChange={(e) => setVerifyContacts(e.target.checked)}
              className="h-4 w-4 rounded border-[hsl(var(--border))] accent-[hsl(var(--primary))]"
            />
            Verify contacts (MX / SPF / DMARC)
          </label>

          <label
            className="flex cursor-pointer items-center gap-2 text-sm text-[hsl(var(--foreground))]"
            title="Attempts a live SMTP mailbox probe. Slower and often inconclusive — many mail servers block this."
          >
            <input
              type="checkbox"
              checked={smtpVerify}
              onChange={(e) => setSmtpVerify(e.target.checked)}
              disabled={!verifyContacts}
              className="h-4 w-4 rounded border-[hsl(var(--border))] accent-[hsl(var(--primary))] disabled:opacity-40"
            />
            Deep SMTP verify (slower, best-effort)
          </label>
        </div>

        {scanError && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-500">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {scanError}
          </div>
        )}

        <div className="mt-5">
          <button
            type="submit"
            disabled={scanning || !targetUrl.trim()}
            className="flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
            {scanning ? 'Scanning…' : 'Start Scan'}
          </button>
        </div>
      </form>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Results */}
        <div>
          {loadingJob && (
            <div className="flex items-center justify-center rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] py-16">
              <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--primary))]" />
            </div>
          )}

          {!loadingJob && !selectedJob && (
            <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] py-16 text-center">
              <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-[hsl(var(--muted-foreground))]/40" />
              <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
                Start a scan or select a job from the history to see results
              </p>
            </div>
          )}

          {!loadingJob && selectedJob && (
            <div>
              {/* Job summary */}
              <div className="mb-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 font-semibold text-[hsl(var(--foreground))]">
                      <Globe className="h-4 w-4 text-[hsl(var(--primary))]" />
                      {selectedJob.companyName || new URL(selectedJob.targetUrl).host}
                      <a
                        href={selectedJob.targetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </p>
                    <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{selectedJob.targetUrl}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      selectedJob.status === 'COMPLETED'
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : selectedJob.status === 'FAILED'
                          ? 'bg-red-500/10 text-red-500'
                          : 'bg-amber-500/10 text-amber-500'
                    }`}
                  >
                    {selectedJob.status}
                  </span>
                </div>

                {selectedJob.errorMessage && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                    <FileWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {selectedJob.errorMessage}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-[hsl(var(--muted))] px-3 py-1 text-xs font-medium text-[hsl(var(--foreground))]">
                    {selectedJob.pagesCrawled} pages crawled
                  </span>
                  {selectedJob.pagesFailed > 0 && (
                    <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-500">
                      {selectedJob.pagesFailed} failed
                    </span>
                  )}
                  <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-500">
                    {selectedJob.emailsFound} emails
                  </span>
                  <span className="rounded-full bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-500">
                    {selectedJob.phonesFound} phones
                  </span>
                </div>
              </div>

              {/* Contacts table */}
              {selectedJob.contacts && selectedJob.contacts.length > 0 ? (
                <div className="overflow-x-auto rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40">
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                          Contact
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                          Found On
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                          Credibility
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                          Score
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                          Review
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[hsl(var(--border))]">
                      {selectedJob.contacts.map((contact) => (
                        <tr key={contact.id} className="hover:bg-[hsl(var(--muted))]/30">
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-2 font-medium text-[hsl(var(--foreground))]">
                              {contact.type === 'EMAIL' ? (
                                <Mail className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
                              ) : (
                                <Phone className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
                              )}
                              <span className="truncate">{contact.value}</span>
                            </span>
                            {contact.deliverability && (
                              <span className="ml-5.5 mt-0.5 block text-xs text-[hsl(var(--muted-foreground))]">
                                {contact.deliverability}
                              </span>
                            )}
                          </td>
                          <td className="max-w-[220px] px-4 py-3">
                            <a
                              href={contact.pageUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate text-xs text-[hsl(var(--primary))] hover:underline"
                            >
                              {contact.pageUrl}
                            </a>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                                CREDIBILITY_STYLES[contact.credibility] || CREDIBILITY_STYLES.rejected
                              }`}
                            >
                              {contact.credibility}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs font-medium text-[hsl(var(--foreground))]">
                            {contact.score}/100
                          </td>
                          <td className="px-4 py-3">
                            {contact.reviewStatus === 'PENDING' ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleReview(contact.id, 'APPROVED')}
                                  className="rounded-lg p-1.5 text-emerald-500 hover:bg-emerald-500/10"
                                  title="Approve"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleReview(contact.id, 'REJECTED')}
                                  className="rounded-lg p-1.5 text-red-500 hover:bg-red-500/10"
                                  title="Reject"
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <span
                                className={`text-xs font-semibold ${
                                  contact.reviewStatus === 'APPROVED' ? 'text-emerald-500' : 'text-red-500'
                                }`}
                              >
                                {contact.reviewStatus === 'APPROVED' ? 'Approved' : 'Rejected'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                selectedJob.status === 'COMPLETED' && (
                  <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] py-12 text-center">
                    <AlertCircle className="mx-auto mb-3 h-8 w-8 text-[hsl(var(--muted-foreground))]/40" />
                    <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
                      No contacts were found on this website.
                    </p>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Job History */}
        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            Scan History
          </h2>
          <div className="space-y-2">
            {loadingJobs && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--primary))]" />
              </div>
            )}

            {!loadingJobs && jobs.length === 0 && (
              <p className="rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 text-center text-xs text-[hsl(var(--muted-foreground))]">
                No scans yet
              </p>
            )}

            {jobs.map((job) => (
              <button
                key={job.id}
                onClick={() => loadJob(job.id)}
                className={`group flex w-full items-start justify-between gap-2 rounded-xl border p-3 text-left transition-colors ${
                  selectedJob?.id === job.id
                    ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5'
                    : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted))]/40'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">
                    {job.companyName || (() => {
                      try {
                        return new URL(job.targetUrl).host;
                      } catch {
                        return job.targetUrl;
                      }
                    })()}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                    <Clock className="h-3 w-3" />
                    {formatDate(job.createdAt)}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        job.status === 'COMPLETED'
                          ? 'bg-emerald-500'
                          : job.status === 'FAILED'
                            ? 'bg-red-500'
                            : 'bg-amber-500'
                      }`}
                    />
                    {job._count?.contacts ?? 0} contacts
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteJob(job.id);
                    }}
                    className="rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100"
                  >
                    {deletingId === job.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]/40" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
