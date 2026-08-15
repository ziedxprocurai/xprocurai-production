'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Send,
  Inbox,
  Loader2,
  Building2,
  Package,
  Calendar,
  MessageSquare,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Eye,
  X,
  Mail,
  Phone,
  Radar,
} from 'lucide-react';

interface RFQ {
  id: string;
  title: string;
  description?: string;
  quantity: number;
  status: 'PENDING' | 'REVIEWED' | 'RESPONDED' | 'ACCEPTED' | 'REJECTED';
  response?: string;
  createdAt: string;
  updatedAt: string;
  buyer?: {
    id: string;
    legalName: string;
    country: string;
    city?: string;
  };
  supplier?: {
    id: string;
    legalName: string;
    country: string;
    city?: string;
  };
  product?: {
    id: string;
    name: string;
    description?: string;
  };
  // xDiscoveryBeta: RFQs sent to leads that aren't onboarded suppliers yet.
  isExternal?: boolean;
  leadCompanyId?: number | null;
  externalCompanyName?: string | null;
  externalCompanyDomain?: string | null;
  externalContactName?: string | null;
  externalContactEmail?: string | null;
  externalContactPhone?: string | null;
  sentVia?: string | null;
  // Groups RFQs sent together in one "Request Quote" action (e.g. selecting
  // several xDiscoveryBeta companies at once) so they can be rendered as a
  // single card with one status per targeted company.
  batchId?: string | null;
}

function supplierName(rfq: RFQ, activeTab: 'sent' | 'received') {
  if (rfq.isExternal) return rfq.externalCompanyName || 'External lead';
  return activeTab === 'sent' ? rfq.supplier?.legalName : rfq.buyer?.legalName;
}

interface RFQGroup {
  key: string;
  items: RFQ[];
}

/** Groups RFQs sharing a batchId together, preserving the incoming order. */
function groupRFQs(list: RFQ[]): RFQGroup[] {
  const byBatch = new Map<string, RFQ[]>();
  for (const rfq of list) {
    if (!rfq.batchId) continue;
    const arr = byBatch.get(rfq.batchId) || [];
    arr.push(rfq);
    byBatch.set(rfq.batchId, arr);
  }

  const groups: RFQGroup[] = [];
  const seen = new Set<string>();
  for (const rfq of list) {
    const key = rfq.batchId || rfq.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const items = rfq.batchId ? byBatch.get(rfq.batchId)! : [rfq];
    groups.push({ key, items });
  }
  return groups;
}

const STATUS_CONFIG = {
  PENDING: {
    label: 'Pending',
    icon: Clock,
    color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  },
  REVIEWED: {
    label: 'Reviewed',
    icon: Eye,
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  },
  RESPONDED: {
    label: 'Responded',
    icon: MessageSquare,
    color: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
  },
  ACCEPTED: {
    label: 'Accepted',
    icon: CheckCircle,
    color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  },
  REJECTED: {
    label: 'Rejected',
    icon: XCircle,
    color: 'text-red-500 bg-red-500/10 border-red-500/20',
  },
};

export function RFQsContent() {
  const [activeTab, setActiveTab] = useState<'sent' | 'received'>('sent');
  const [sentRFQs, setSentRFQs] = useState<RFQ[]>([]);
  const [receivedRFQs, setReceivedRFQs] = useState<RFQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRFQ, setSelectedRFQ] = useState<RFQ | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [company, setCompany] = useState<any>(null);

  const isBuyer = company?.roles?.includes('BUYER');
  const isSupplier = company?.roles?.includes('SUPPLIER');

  useEffect(() => {
    fetchCompanyAndRFQs();
  }, []);

  async function fetchCompanyAndRFQs() {
    try {
      setLoading(true);
      const companyRes = await fetch('/api/companies/me');
      if (companyRes.ok) {
        const companyData = await companyRes.json();
        setCompany(companyData);

        if (companyData?.roles?.includes('BUYER')) {
          await fetchSentRFQs();
        }
        if (companyData?.roles?.includes('SUPPLIER')) {
          await fetchReceivedRFQs();
        }
      }
    } catch {
      setError('Unable to connect to the server');
    } finally {
      setLoading(false);
    }
  }

  async function fetchSentRFQs() {
    try {
      const res = await fetch('/api/rfqs/sent');
      if (res.ok) {
        const data = await res.json();
        setSentRFQs(data);
      }
    } catch {
      setError('Failed to load sent RFQs');
    }
  }

  async function fetchReceivedRFQs() {
    try {
      const res = await fetch('/api/rfqs/received');
      if (res.ok) {
        const data = await res.json();
        setReceivedRFQs(data);
      }
    } catch {
      setError('Failed to load received RFQs');
    }
  }

  function openDetailModal(rfq: RFQ) {
    setSelectedRFQ(rfq);
    setResponseText(rfq.response || '');
    setShowDetailModal(true);
    setError('');
  }

  function closeDetailModal() {
    setShowDetailModal(false);
    setSelectedRFQ(null);
    setResponseText('');
  }

  async function handleStatusUpdate(status: RFQ['status']) {
    if (!selectedRFQ) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/rfqs/${selectedRFQ.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, response: responseText }),
      });

      if (res.ok) {
        await fetchReceivedRFQs();
        closeDetailModal();
      } else {
        const data = await res.json();
        setError(data.message || 'Failed to update RFQ');
      }
    } catch {
      setError('Unable to connect to the server');
    } finally {
      setSubmitting(false);
    }
  }

  const currentRFQs = activeTab === 'sent' ? sentRFQs : receivedRFQs;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading RFQs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">RFQ Management</h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Manage your requests for quotes
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-[hsl(var(--border))]">
          {isBuyer && (
            <button
              onClick={() => setActiveTab('sent')}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'sent'
                  ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                  : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              <Send className="h-4 w-4" />
              Sent RFQs ({sentRFQs.length})
            </button>
          )}
          {isSupplier && (
            <button
              onClick={() => setActiveTab('received')}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'received'
                  ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                  : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              <Inbox className="h-4 w-4" />
              Received RFQs ({receivedRFQs.length})
            </button>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {/* RFQs List */}
        {currentRFQs.length === 0 ? (
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-[hsl(var(--muted-foreground))]" />
            <h3 className="mt-4 text-lg font-semibold text-[hsl(var(--foreground))]">
              No RFQs {activeTab === 'sent' ? 'sent' : 'received'} yet
            </h3>
            <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
              {activeTab === 'sent'
                ? 'Search for products and submit RFQs to suppliers'
                : 'RFQs from buyers will appear here'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupRFQs(currentRFQs).map((group) =>
              group.items.length > 1 ? (
                <BatchRFQCard
                  key={group.key}
                  items={group.items}
                  activeTab={activeTab}
                  onViewItem={openDetailModal}
                />
              ) : (
                <SingleRFQCard
                  key={group.key}
                  rfq={group.items[0]}
                  activeTab={activeTab}
                  onView={openDetailModal}
                />
              ),
            )}
          </div>
        )}

        {/* Detail Modal */}
        {showDetailModal && selectedRFQ && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-xl">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-[hsl(var(--foreground))]">RFQ Details</h2>
                <button
                  onClick={closeDetailModal}
                  className="rounded-lg p-1 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Status:</span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${STATUS_CONFIG[selectedRFQ.status].color}`}
                  >
                    {React.createElement(STATUS_CONFIG[selectedRFQ.status].icon, { className: 'h-3 w-3' })}
                    {STATUS_CONFIG[selectedRFQ.status].label}
                  </span>
                </div>

                {/* RFQ Information */}
                <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-4">
                  <h3 className="mb-3 font-semibold text-[hsl(var(--foreground))]">{selectedRFQ.title}</h3>
                  {selectedRFQ.description && (
                    <p className="mb-3 text-sm text-[hsl(var(--muted-foreground))]">
                      {selectedRFQ.description}
                    </p>
                  )}
                  <div className="grid gap-2 text-sm">
                    {selectedRFQ.product && (
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                        <span className="font-medium">Product:</span>
                        <span className="text-[hsl(var(--muted-foreground))]">
                          {selectedRFQ.product.name}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Quantity:</span>
                      <span className="text-[hsl(var(--muted-foreground))]">{selectedRFQ.quantity}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                      <span className="font-medium">
                        {activeTab === 'sent' ? 'Supplier:' : 'Buyer:'}
                      </span>
                      <span className="text-[hsl(var(--muted-foreground))]">
                        {supplierName(selectedRFQ, activeTab)}
                      </span>
                      {selectedRFQ.isExternal && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-500">
                          <Radar className="h-3 w-3" />
                          xDiscovery Beta lead
                        </span>
                      )}
                    </div>
                    {selectedRFQ.isExternal && (
                      <>
                        {selectedRFQ.externalContactName && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Contact:</span>
                            <span className="text-[hsl(var(--muted-foreground))]">{selectedRFQ.externalContactName}</span>
                          </div>
                        )}
                        {selectedRFQ.externalContactEmail && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                            <span className="font-medium">Email used:</span>
                            <span className="text-[hsl(var(--muted-foreground))]">{selectedRFQ.externalContactEmail}</span>
                          </div>
                        )}
                        {selectedRFQ.externalContactPhone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                            <span className="font-medium">Phone used:</span>
                            <span className="text-[hsl(var(--muted-foreground))]">{selectedRFQ.externalContactPhone}</span>
                          </div>
                        )}
                        <p className="text-xs italic text-[hsl(var(--muted-foreground))]">
                          This request was sent to a lead sourced from xDiscovery Beta, not yet an onboarded
                          supplier — the send is mocked for now.
                        </p>
                      </>
                    )}
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                      <span className="font-medium">Submitted:</span>
                      <span className="text-[hsl(var(--muted-foreground))]">
                        {new Date(selectedRFQ.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Response Section - Only for suppliers on received RFQs */}
                {activeTab === 'received' && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[hsl(var(--foreground))]">
                      Response
                    </label>
                    <textarea
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      rows={4}
                      className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
                      placeholder="Enter your response to this RFQ..."
                    />
                  </div>
                )}

                {/* Existing Response Display - For buyers viewing sent RFQs */}
                {activeTab === 'sent' && selectedRFQ.response && (
                  <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-4">
                    <h4 className="mb-2 text-sm font-medium text-[hsl(var(--foreground))]">
                      Supplier Response:
                    </h4>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">{selectedRFQ.response}</p>
                  </div>
                )}

                {error && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                    <p className="text-sm text-red-500">{error}</p>
                  </div>
                )}

                {/* Action Buttons - Only for suppliers on received RFQs */}
                {activeTab === 'received' && (
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => handleStatusUpdate('REVIEWED')}
                      disabled={submitting}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))] disabled:opacity-50"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                      Mark as Reviewed
                    </button>
                    <button
                      onClick={() => handleStatusUpdate('RESPONDED')}
                      disabled={submitting || !responseText.trim()}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MessageSquare className="h-4 w-4" />
                      )}
                      Send Response
                    </button>
                    <button
                      onClick={() => handleStatusUpdate('ACCEPTED')}
                      disabled={submitting}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                      Accept
                    </button>
                    <button
                      onClick={() => handleStatusUpdate('REJECTED')}
                      disabled={submitting}
                      className="flex items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                      Reject
                    </button>
                  </div>
                )}

                {/* Close Button for Buyers */}
                {activeTab === 'sent' && (
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={closeDetailModal}
                      className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))]"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: RFQ['status'] }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${config.color}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

function SingleRFQCard({
  rfq,
  activeTab,
  onView,
}: {
  rfq: RFQ;
  activeTab: 'sent' | 'received';
  onView: (rfq: RFQ) => void;
}) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 transition-shadow hover:shadow-lg">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">{rfq.title}</h3>
                {rfq.isExternal && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-500">
                    <Radar className="h-3 w-3" />
                    External lead
                  </span>
                )}
              </div>
              {rfq.description && (
                <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{rfq.description}</p>
              )}
            </div>
            <StatusBadge status={rfq.status} />
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {rfq.product && (
              <div className="flex items-center gap-2 text-sm">
                <Package className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                <span className="text-[hsl(var(--foreground))]">{rfq.product.name}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              <span className="text-[hsl(var(--foreground))]">{supplierName(rfq, activeTab)}</span>
            </div>
            {rfq.isExternal && (rfq.externalContactEmail || rfq.externalContactPhone) && (
              <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                {rfq.externalContactEmail ? <Mail className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                <span className="truncate">{rfq.externalContactEmail || rfq.externalContactPhone}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
              <span>Qty: {rfq.quantity}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
              <Calendar className="h-4 w-4" />
              {new Date(rfq.createdAt).toLocaleDateString()}
            </div>
          </div>

          <button onClick={() => onView(rfq)} className="text-sm font-medium text-[hsl(var(--primary))] hover:underline">
            View Details →
          </button>
        </div>
      </div>
    </div>
  );
}

function BatchRFQCard({
  items,
  activeTab,
  onViewItem,
}: {
  items: RFQ[];
  activeTab: 'sent' | 'received';
  onViewItem: (rfq: RFQ) => void;
}) {
  const first = items[0];
  const statusCounts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 transition-shadow hover:shadow-lg">
      <div className="mb-4 flex flex-col gap-3 border-b border-[hsl(var(--border))] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">{first.title}</h3>
            <span className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/10 px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--primary))]">
              <Building2 className="h-3 w-3" />
              {items.length} companies
            </span>
            {first.isExternal && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-500">
                <Radar className="h-3 w-3" />
                xDiscovery Beta batch
              </span>
            )}
          </div>
          {first.description && (
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{first.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[hsl(var(--muted-foreground))]">
            <span>Qty per company: {first.quantity}</span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(first.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Status summary across the batch */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(statusCounts).map(([status, count]) => (
            <span
              key={status}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_CONFIG[status as RFQ['status']].color}`}
            >
              {count} {STATUS_CONFIG[status as RFQ['status']].label}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[hsl(var(--border))] p-3"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Building2 className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">
                  {supplierName(item, activeTab)}
                </p>
                {item.isExternal && (item.externalContactEmail || item.externalContactPhone) && (
                  <p className="flex items-center gap-1 truncate text-xs text-[hsl(var(--muted-foreground))]">
                    {item.externalContactEmail ? <Mail className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
                    {item.externalContactEmail || item.externalContactPhone}
                  </p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <StatusBadge status={item.status} />
              <button onClick={() => onViewItem(item)} className="text-xs font-medium text-[hsl(var(--primary))] hover:underline">
                View →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
