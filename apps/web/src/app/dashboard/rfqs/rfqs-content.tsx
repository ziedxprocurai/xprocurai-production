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
  Paperclip,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  RefreshCw,
  Tag,
} from 'lucide-react';
import {
  INCOTERMS,
  PAYMENT_TERMS_SUGGESTIONS,
  QUOTE_CURRENCIES,
  formatFileSize,
  unitLabel,
} from '@/lib/rfq-constants';

interface RFQAttachmentItem {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType?: string | null;
  createdAt?: string;
}

// Prisma Decimal fields serialize to strings in JSON — always Number() them
// before arithmetic or formatting.
interface RFQQuote {
  id: string;
  supplierName: string;
  unitPrice: string | number;
  totalPrice: string | number;
  currency: string;
  deliveryTimeDays?: number | null;
  leadTimeDays?: number | null;
  paymentTerms?: string | null;
  certifications?: string[];
  validUntil?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

type RFQEmailStatus = 'QUEUED' | 'SENT' | 'WAITING_REPLY' | 'REPLIED' | 'FAILED';

interface RfqRequestPayloadShape {
  title?: string;
  category?: string | null;
  itemName?: string | null;
  specifications?: string | null;
  quantity?: number | null;
  unitOfMeasure?: string | null;
  requiredDeliveryDate?: string | null;
  deliveryLocation?: string | null;
  currency?: string | null;
  targetBudget?: number | null;
  incoterm?: string | null;
  paymentTerms?: string | null;
  additionalRequirements?: string | null;
  attachments?: {
    path: string;
    fileName: string;
    fileSize: number;
    mimeType?: string | null;
  }[];
}

interface RFQ {
  id: string;
  title: string;
  description?: string;
  category?: string | null;
  itemName?: string | null;
  quantity: number;
  unitOfMeasure?: string | null;
  attachments?: RFQAttachmentItem[];
  quote?: RFQQuote | null;
  status: 'PENDING' | 'REVIEWED' | 'RESPONDED' | 'ACCEPTED' | 'REJECTED';
  response?: string;
  reference?: string | null;
  emailStatus?: RFQEmailStatus | null;
  emailError?: string | null;
  emailSentAt?: string | null;
  lastReplyAt?: string | null;
  requiredDeliveryDate?: string | null;
  deliveryLocation?: string | null;
  currency?: string | null;
  targetBudget?: string | number | null;
  incoterm?: string | null;
  paymentTerms?: string | null;
  additionalRequirements?: string | null;
  requestPayload?: RfqRequestPayloadShape | null;
  _count?: { messages: number };
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

/** "Qty: 500 Kg" — falls back to the bare quantity for older RFQs with no unit. */
function quantityLabel(rfq: RFQ, prefix = 'Qty') {
  const unit = unitLabel(rfq.unitOfMeasure);
  return `${prefix}: ${rfq.quantity ?? '—'}${unit ? ` ${unit}` : ''}`;
}

function formatQuoteAmount(amount: string | number | null | undefined, currency?: string | null) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: currency || 'TND',
    }).format(value);
  } catch {
    return `${value.toLocaleString()} ${currency || ''}`.trim();
  }
}

function isQuoteExpired(quote?: RFQQuote | null) {
  if (!quote?.validUntil) return false;
  const end = new Date(quote.validUntil);
  if (Number.isNaN(end.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return end < today;
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

const EMAIL_STATUS_CONFIG: Record<
  RFQEmailStatus,
  { label: string; icon: typeof Clock; color: string }
> = {
  QUEUED: {
    label: 'Sending…',
    icon: Loader2,
    color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  },
  SENT: {
    label: 'No reply yet',
    icon: Clock,
    color: 'text-slate-500 bg-slate-500/10 border-slate-500/20',
  },
  WAITING_REPLY: {
    label: 'No reply yet',
    icon: Clock,
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  },
  REPLIED: {
    label: 'Reply received',
    icon: MessageSquare,
    color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  },
  FAILED: {
    label: 'Failed',
    icon: XCircle,
    color: 'text-red-500 bg-red-500/10 border-red-500/20',
  },
};

interface RFQMessageAttachmentItem {
  id: string;
  filename: string;
  mimeType?: string | null;
  size: number;
  isInline: boolean;
  attachmentType: string;
}

interface RFQMessageItem {
  id: string;
  direction: 'OUTBOUND' | 'INBOUND';
  kind: 'RFQ_REQUEST' | 'REPLY' | 'AUTO_REPLY' | 'BOUNCE';
  subject?: string | null;
  fromEmail?: string | null;
  fromName?: string | null;
  toRecipients?: unknown;
  bodyText?: string | null;
  bodyHtml?: string | null;
  sentAt?: string | null;
  receivedAt?: string | null;
  createdAt: string;
  senderMatchesSupplier?: boolean | null;
  attachments?: RFQMessageAttachmentItem[];
}

const EMAIL_CSP_META =
  '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: cid:; style-src \'unsafe-inline\'; font-src data:">';

/** toRecipients is stored as [{address,name}] (outbound) or Graph's
 * [{emailAddress:{address,name}}] (inbound) — normalize for display. */
function recipientLabel(value: unknown): string {
  if (!Array.isArray(value)) return '';
  return value
    .map((r) => {
      const addr = r?.emailAddress?.address ?? r?.address ?? '';
      const name = r?.emailAddress?.name ?? r?.name;
      if (name && addr) return `${name} <${addr}>`;
      return addr || name || '';
    })
    .filter(Boolean)
    .join(', ');
}

function messageTimestamp(message: RFQMessageItem): string {
  const raw = message.sentAt ?? message.receivedAt ?? message.createdAt;
  return raw ? new Date(raw).toLocaleString() : '';
}

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
  const [messages, setMessages] = useState<RFQMessageItem[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState('');
  const [retryingSend, setRetryingSend] = useState(false);

  const isBuyer = company?.roles?.includes('BUYER');
  const isSupplier = company?.roles?.includes('SUPPLIER');
  // Buyers record quotes received offline for RFQs they sent; onboarded
  // suppliers may record the quote they returned on RFQs they received.
  const canRecordQuote = activeTab === 'sent' ? !!isBuyer : !!isSupplier;

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
    setMessages([]);
    setMessagesError('');
    setMessagesLoading(false);
    // The email conversation is only meaningful for emailed sent RFQs.
    if (activeTab === 'sent' && rfq.emailStatus) {
      void fetchRfqMessages(rfq.id);
    }
  }

  function closeDetailModal() {
    setShowDetailModal(false);
    setSelectedRFQ(null);
    setResponseText('');
    setMessages([]);
    setMessagesError('');
  }

  async function fetchRfqMessages(rfqId: string) {
    setMessagesLoading(true);
    setMessagesError('');
    try {
      const res = await fetch(`/api/rfqs/${rfqId}/messages`);
      if (!res.ok) {
        throw new Error('Failed to load the conversation');
      }
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {
      setMessagesError('Failed to load the conversation');
    } finally {
      setMessagesLoading(false);
    }
  }

  async function handleRetrySend() {
    if (!selectedRFQ) return;
    setRetryingSend(true);
    setError('');
    try {
      const res = await fetch(`/api/rfqs/${selectedRFQ.id}/send`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        // A failed send still returns the RFQ (with emailStatus FAILED) — the
        // row always exists, so replace it in state either way.
        setSentRFQs((prev) => prev.map((r) => (r.id === data.id ? data : r)));
        setReceivedRFQs((prev) => prev.map((r) => (r.id === data.id ? data : r)));
        setSelectedRFQ(data);
        void fetchRfqMessages(data.id);
      } else {
        setError(data.message || 'Failed to resend the RFQ email');
      }
    } catch {
      setError('Unable to connect to the server');
    } finally {
      setRetryingSend(false);
    }
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

  function handleQuoteSaved(updated: RFQ) {
    setSentRFQs((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setReceivedRFQs((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setSelectedRFQ(updated);
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
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-xl">
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
                {/* Status Badge — emailed RFQs show the email lifecycle instead */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Status:</span>
                  {selectedRFQ.emailStatus ? (
                    <EmailStatusBadge status={selectedRFQ.emailStatus} />
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${STATUS_CONFIG[selectedRFQ.status].color}`}
                    >
                      {React.createElement(STATUS_CONFIG[selectedRFQ.status].icon, { className: 'h-3 w-3' })}
                      {STATUS_CONFIG[selectedRFQ.status].label}
                    </span>
                  )}
                </div>

                {/* RFQ Information */}
                <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-[hsl(var(--foreground))]">{selectedRFQ.title}</h3>
                    {selectedRFQ.reference && (
                      <span className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[hsl(var(--muted-foreground))]">
                        {selectedRFQ.reference}
                      </span>
                    )}
                    {selectedRFQ.category && (
                      <span className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2.5 py-0.5 text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
                        {selectedRFQ.category}
                      </span>
                    )}
                  </div>
                  {selectedRFQ.itemName && (
                    <p className="mb-3 text-sm font-medium text-[hsl(var(--foreground))]">
                      {selectedRFQ.itemName}
                    </p>
                  )}
                  {selectedRFQ.description && (
                    <div className="mb-3">
                      {selectedRFQ.itemName && (
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                          Specifications
                        </p>
                      )}
                      <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        {selectedRFQ.description}
                      </p>
                    </div>
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
                      <span className="text-[hsl(var(--muted-foreground))]">
                        {selectedRFQ.quantity}
                        {selectedRFQ.unitOfMeasure ? ` ${unitLabel(selectedRFQ.unitOfMeasure)}` : ''}
                      </span>
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
                          supplier.
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

                {/* Request details — every populated field of the submitted
                    payload (columns first, requestPayload as fallback) */}
                <RequestDetails rfq={selectedRFQ} />

                {/* Email failure panel */}
                {selectedRFQ.emailStatus === 'FAILED' && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
                    <p className="mb-1 text-sm font-medium text-red-500">Email delivery failed</p>
                    {selectedRFQ.emailError && (
                      <p className="mb-3 text-xs text-red-500/80">{selectedRFQ.emailError}</p>
                    )}
                    <button
                      onClick={handleRetrySend}
                      disabled={retryingSend}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                    >
                      {retryingSend ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Retry sending
                    </button>
                  </div>
                )}

                {/* Conversation */}
                {activeTab === 'sent' && selectedRFQ.emailStatus && (
                  <ConversationSection
                    rfq={selectedRFQ}
                    messages={messages}
                    loading={messagesLoading}
                    error={messagesError}
                    onRefresh={() => void fetchRfqMessages(selectedRFQ.id)}
                  />
                )}

                {/* Attachments */}
                {(selectedRFQ.attachments?.length ?? 0) > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium text-[hsl(var(--foreground))]">
                      Attachments
                    </p>
                    <ul className="space-y-1.5">
                      {selectedRFQ.attachments!.map((attachment) => (
                        <li key={attachment.id}>
                          <a
                            href={`/api/rfqs/attachments/${attachment.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm transition-colors hover:bg-[hsl(var(--muted))]"
                          >
                            <Paperclip className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
                            <span className="min-w-0 flex-1 truncate text-[hsl(var(--foreground))]">
                              {attachment.fileName}
                            </span>
                            <span className="shrink-0 text-xs text-[hsl(var(--muted-foreground))]">
                              {formatFileSize(attachment.fileSize)}
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Supplier quotation */}
                <QuoteSection
                  rfq={selectedRFQ}
                  defaultSupplierName={supplierName(selectedRFQ, activeTab) || ''}
                  canEdit={canRecordQuote}
                  onSaved={handleQuoteSaved}
                />

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

function EmailStatusBadge({ status }: { status: RFQEmailStatus }) {
  const config = EMAIL_STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${config.color}`}>
      <Icon className={`h-3 w-3 ${status === 'QUEUED' ? 'animate-spin' : ''}`} />
      {config.label}
    </span>
  );
}

/** Emailed RFQs display their email lifecycle badge; everything else keeps
 * the RFQ status badge. */
function RfqBadge({ rfq }: { rfq: RFQ }) {
  return rfq.emailStatus ? (
    <EmailStatusBadge status={rfq.emailStatus} />
  ) : (
    <StatusBadge status={rfq.status} />
  );
}

function ReferenceChip({ reference }: { reference?: string | null }) {
  if (!reference) return null;
  return (
    <span className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[hsl(var(--muted-foreground))]">
      {reference}
    </span>
  );
}

/** Small thread indicator — only when at least one inbound reply exists. */
function ReplyCount({ rfq }: { rfq: RFQ }) {
  const inbound = Math.max(0, (rfq._count?.messages ?? 0) - (rfq.emailSentAt ? 1 : 0));
  if (!rfq.lastReplyAt || inbound === 0) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-500"
      title={`Last reply ${new Date(rfq.lastReplyAt).toLocaleString()}`}
    >
      <MessageSquare className="h-3 w-3" />
      {inbound} {inbound === 1 ? 'reply' : 'replies'}
    </span>
  );
}

function RequestDetails({ rfq }: { rfq: RFQ }) {
  const payload = rfq.requestPayload ?? {};
  const quantity = rfq.quantity ?? payload.quantity;
  const unit = rfq.unitOfMeasure ?? payload.unitOfMeasure;
  const incotermValue = rfq.incoterm ?? payload.incoterm;
  const incotermLabel = incotermValue
    ? (INCOTERMS.find((i) => i.value === incotermValue)?.label ?? incotermValue)
    : null;
  const budget = rfq.targetBudget ?? payload.targetBudget;
  const currency = rfq.currency ?? payload.currency;
  const deliveryDate = rfq.requiredDeliveryDate ?? payload.requiredDeliveryDate;
  const specifications = rfq.description ?? payload.specifications;
  const additional = rfq.additionalRequirements ?? payload.additionalRequirements;

  const rows: { label: string; value: string; mono?: boolean }[] = [];
  if (rfq.reference) rows.push({ label: 'Reference', value: rfq.reference, mono: true });
  const title = rfq.title || payload.title;
  if (title) rows.push({ label: 'Title', value: title });
  const category = rfq.category ?? payload.category;
  if (category) rows.push({ label: 'Category', value: category });
  const itemName = rfq.itemName ?? payload.itemName;
  if (itemName) rows.push({ label: 'Item / Service', value: itemName });
  if (quantity != null) {
    rows.push({ label: 'Quantity', value: `${quantity}${unit ? ` ${unitLabel(unit)}` : ''}` });
  }
  if (deliveryDate) {
    rows.push({ label: 'Delivery date', value: new Date(deliveryDate).toLocaleDateString() });
  }
  const location = rfq.deliveryLocation ?? payload.deliveryLocation;
  if (location) rows.push({ label: 'Delivery location', value: location });
  if (currency) rows.push({ label: 'Currency', value: currency });
  if (budget != null && Number.isFinite(Number(budget))) {
    rows.push({ label: 'Target budget', value: formatQuoteAmount(budget, currency) });
  }
  if (incotermLabel) rows.push({ label: 'Incoterm', value: incotermLabel });
  const payment = rfq.paymentTerms ?? payload.paymentTerms;
  if (payment) rows.push({ label: 'Payment terms', value: payment });
  if (specifications) rows.push({ label: 'Specifications', value: specifications });
  if (additional) rows.push({ label: 'Additional requirements', value: additional });

  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
        Request details
      </p>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className={row.value.length > 120 ? 'sm:col-span-2' : ''}>
            <dt className="text-xs font-medium text-[hsl(var(--muted-foreground))]">{row.label}</dt>
            <dd
              className={`whitespace-pre-wrap break-words text-[hsl(var(--foreground))] ${row.mono ? 'font-mono text-xs' : ''}`}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ConversationSection({
  rfq,
  messages,
  loading,
  error,
  onRefresh,
}: {
  rfq: RFQ;
  messages: RFQMessageItem[];
  loading: boolean;
  error: string;
  onRefresh: () => void;
}) {
  return (
    <div className="rounded-lg border border-[hsl(var(--border))] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          Conversation
        </p>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="rounded-md p-1 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] disabled:opacity-50"
          aria-label="Refresh conversation"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {loading && (
        <p className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading conversation…
        </p>
      )}
      {!loading && error && <p className="text-sm text-red-500">{error}</p>}
      {!loading && !error && messages.length === 0 && (
        <p className="text-sm italic text-[hsl(var(--muted-foreground))]">
          No messages recorded yet. Replies will appear here once they arrive.
        </p>
      )}
      {!loading && !error && messages.length > 0 && (
        <div className="space-y-3">
          {messages.map((message) => (
            <MessageItem key={message.id} rfq={rfq} message={message} />
          ))}
        </div>
      )}
    </div>
  );
}

function MessageItem({ rfq, message }: { rfq: RFQ; message: RFQMessageItem }) {
  const [expanded, setExpanded] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const outbound = message.direction === 'OUTBOUND';
  const toLabel = outbound ? recipientLabel(message.toRecipients) : '';

  return (
    <div
      className={`rounded-xl border p-3 text-sm ${
        outbound
          ? 'ml-8 border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/5'
          : 'mr-8 border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30'
      }`}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-xs font-semibold text-[hsl(var(--foreground))]">
          {outbound
            ? `XprocurAi → ${toLabel || 'supplier'}`
            : message.fromName
              ? `${message.fromName} <${message.fromEmail}>`
              : message.fromEmail || 'Unknown sender'}
        </span>
        <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
          {messageTimestamp(message)}
        </span>
        {message.kind === 'AUTO_REPLY' && (
          <span className="rounded-full border border-slate-500/30 bg-slate-500/10 px-2 py-0.5 text-[10px] font-medium text-slate-500">
            Auto-reply
          </span>
        )}
        {message.kind === 'BOUNCE' && (
          <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-500">
            Delivery failure
          </span>
        )}
        {!outbound && message.senderMatchesSupplier === false && (
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-500">
            Different sender
          </span>
        )}
      </div>
      {message.subject && (
        <p className="mb-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">
          {message.subject}
        </p>
      )}
      {message.bodyText && (
        <div>
          <p
            className={`whitespace-pre-wrap break-words text-sm text-[hsl(var(--foreground))] ${
              expanded ? '' : 'line-clamp-[12]'
            }`}
          >
            {message.bodyText}
          </p>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 text-xs font-medium text-[hsl(var(--primary))] hover:underline"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        </div>
      )}
      {message.bodyHtml && (
        <div className="mt-1">
          <button
            onClick={() => setShowOriginal((v) => !v)}
            className="text-xs font-medium text-[hsl(var(--primary))] hover:underline"
          >
            {showOriginal ? 'Hide original' : 'View original'}
          </button>
          {showOriginal && (
            <iframe
              sandbox=""
              srcDoc={`${EMAIL_CSP_META}${message.bodyHtml}`}
              referrerPolicy="no-referrer"
              title="Original email"
              className="mt-2 h-[400px] w-full rounded-lg border border-[hsl(var(--border))] bg-white"
            />
          )}
        </div>
      )}
      {(message.attachments?.length ?? 0) > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {message.attachments!.map((attachment) => {
            const downloadable = attachment.attachmentType !== 'reference';
            const chip = (
              <>
                <Paperclip className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />
                <span className="max-w-[14rem] truncate">{attachment.filename}</span>
                <span className="shrink-0 text-[10px] text-[hsl(var(--muted-foreground))]">
                  {formatFileSize(attachment.size)}
                </span>
                {attachment.isInline && (
                  <span className="rounded-full bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[9px] font-medium uppercase text-[hsl(var(--muted-foreground))]">
                    inline
                  </span>
                )}
              </>
            );
            return downloadable ? (
              <a
                key={attachment.id}
                href={`/api/rfqs/${rfq.id}/attachments/${attachment.id}/download`}
                className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1 text-[11px] font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))]"
              >
                {chip}
              </a>
            ) : (
              <span
                key={attachment.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 px-2 py-1 text-[11px] text-[hsl(var(--muted-foreground))]"
              >
                {chip}
              </span>
            );
          })}
        </div>
      )}
    </div>
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
                <ReferenceChip reference={rfq.reference} />
                {rfq.category && (
                  <span className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
                    {rfq.category}
                  </span>
                )}
                {rfq.isExternal && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-500">
                    <Radar className="h-3 w-3" />
                    External lead
                  </span>
                )}
                {rfq.quote && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-500">
                    <Tag className="h-3 w-3" />
                    Quote · {formatQuoteAmount(rfq.quote.totalPrice, rfq.quote.currency)}
                  </span>
                )}
              </div>
              {rfq.itemName && (
                <p className="mt-0.5 text-sm font-medium text-[hsl(var(--foreground))]">
                  {rfq.itemName}
                </p>
              )}
              {rfq.description && (
                <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{rfq.description}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <RfqBadge rfq={rfq} />
              <ReplyCount rfq={rfq} />
            </div>
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
              <span>{quantityLabel(rfq)}</span>
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
  const [showCompare, setShowCompare] = useState(false);
  const first = items[0];
  // Emailed RFQs are summarized by their email lifecycle, not RFQStatus.
  const statusCounts = items.reduce<Record<string, number>>((acc, item) => {
    const key = item.emailStatus ?? item.status;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  // Quote comparison helpers: the "best total" highlight only applies when
  // every quote is expressed in the same currency.
  const quoted = items.filter((item) => item.quote);
  const sameCurrency =
    quoted.length > 0 &&
    quoted.every((item) => item.quote!.currency === quoted[0].quote!.currency);
  const totals = quoted
    .map((item) => Number(item.quote!.totalPrice))
    .filter((v) => Number.isFinite(v));
  const bestTotal = sameCurrency && totals.length > 0 ? Math.min(...totals) : null;
  const deliveryValues = quoted
    .map((item) => item.quote!.deliveryTimeDays)
    .filter((d): d is number => typeof d === 'number');
  const fastestDelivery = deliveryValues.length > 0 ? Math.min(...deliveryValues) : null;

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
            {first.category && (
              <span className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
                {first.category}
              </span>
            )}
          </div>
          {first.itemName && (
            <p className="mt-0.5 text-sm font-medium text-[hsl(var(--foreground))]">
              {first.itemName}
            </p>
          )}
          {first.description && (
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{first.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[hsl(var(--muted-foreground))]">
            <span>{quantityLabel(first, 'Qty per company')}</span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(first.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Status summary across the batch */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(statusCounts).map(([status, count]) => {
            const config =
              EMAIL_STATUS_CONFIG[status as RFQEmailStatus] ??
              STATUS_CONFIG[status as RFQ['status']];
            if (!config) return null;
            return (
              <span
                key={status}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${config.color}`}
              >
                {count} {config.label}
              </span>
            );
          })}
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
                <p className="flex items-center gap-2 truncate text-sm font-medium text-[hsl(var(--foreground))]">
                  <span className="truncate">{supplierName(item, activeTab)}</span>
                  <ReferenceChip reference={item.reference} />
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
              {item.quote ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-500">
                  <Tag className="h-3 w-3" />
                  Quote received · {formatQuoteAmount(item.quote.totalPrice, item.quote.currency)}
                </span>
              ) : (
                <span className="text-[11px] italic text-[hsl(var(--muted-foreground))]">
                  Awaiting quote
                </span>
              )}
              <RfqBadge rfq={item} />
              <ReplyCount rfq={item} />
              <button onClick={() => onViewItem(item)} className="text-xs font-medium text-[hsl(var(--primary))] hover:underline">
                View →
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => setShowCompare((v) => !v)}
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--primary))] hover:underline"
      >
        {showCompare ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        Compare quotes ({quoted.length}/{items.length})
      </button>

      {showCompare && (
        <div className="mt-2 overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 text-left text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                <th className="px-3 py-2">Supplier</th>
                <th className="px-3 py-2">Unit price</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Currency</th>
                <th className="px-3 py-2">Delivery (d)</th>
                <th className="px-3 py-2">Lead time (d)</th>
                <th className="px-3 py-2">Payment terms</th>
                <th className="px-3 py-2">Certifications</th>
                <th className="px-3 py-2">Valid until</th>
                <th className="px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const quote = item.quote;
                const total = quote ? Number(quote.totalPrice) : null;
                const isBest =
                  quote != null &&
                  bestTotal != null &&
                  total != null &&
                  Number.isFinite(total) &&
                  total === bestTotal;
                const isFastest =
                  quote != null &&
                  fastestDelivery != null &&
                  quote.deliveryTimeDays === fastestDelivery;
                return (
                  <tr
                    key={item.id}
                    className="border-b border-[hsl(var(--border))] last:border-0"
                  >
                    <td className="px-3 py-2 font-medium text-[hsl(var(--foreground))]">
                      {supplierName(item, activeTab)}
                    </td>
                    {quote ? (
                      <>
                        <td className="px-3 py-2 text-[hsl(var(--foreground))]">
                          {formatQuoteAmount(quote.unitPrice, quote.currency)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={
                              isBest
                                ? 'inline-flex items-center gap-1 font-semibold text-emerald-500'
                                : 'text-[hsl(var(--foreground))]'
                            }
                          >
                            {formatQuoteAmount(quote.totalPrice, quote.currency)}
                            {isBest && (
                              <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase">
                                Best
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-[hsl(var(--muted-foreground))]">
                          {quote.currency}
                        </td>
                        <td
                          className={`px-3 py-2 ${
                            isFastest
                              ? 'font-semibold text-emerald-500'
                              : 'text-[hsl(var(--muted-foreground))]'
                          }`}
                        >
                          {quote.deliveryTimeDays ?? '—'}
                          {isFastest ? ' ⚡' : ''}
                        </td>
                        <td className="px-3 py-2 text-[hsl(var(--muted-foreground))]">
                          {quote.leadTimeDays ?? '—'}
                        </td>
                        <td className="max-w-[10rem] truncate px-3 py-2 text-[hsl(var(--muted-foreground))]">
                          {quote.paymentTerms || '—'}
                        </td>
                        <td className="px-3 py-2">
                          {quote.certifications && quote.certifications.length > 0 ? (
                            <div className="flex max-w-[12rem] flex-wrap gap-1">
                              {quote.certifications.map((cert) => (
                                <span
                                  key={cert}
                                  className="rounded-full bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--foreground))]"
                                >
                                  {cert}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[hsl(var(--muted-foreground))]">—</span>
                          )}
                        </td>
                        <td
                          className={`px-3 py-2 ${
                            isQuoteExpired(quote)
                              ? 'font-medium text-red-500'
                              : 'text-[hsl(var(--muted-foreground))]'
                          }`}
                        >
                          {quote.validUntil
                            ? new Date(quote.validUntil).toLocaleDateString()
                            : '—'}
                          {isQuoteExpired(quote) ? ' (expired)' : ''}
                        </td>
                        <td className="max-w-[12rem] truncate px-3 py-2 text-[hsl(var(--muted-foreground))]">
                          {quote.notes || '—'}
                        </td>
                      </>
                    ) : (
                      <td
                        colSpan={9}
                        className="px-3 py-2 italic text-[hsl(var(--muted-foreground))]"
                      >
                        Awaiting quote
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const QUOTE_INPUT_CLASS =
  'w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20';

function QuoteField({ label, value, accent }: { label: string; value: string; accent?: 'expired' | 'strong' }) {
  return (
    <div>
      <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
      <p
        className={`text-sm ${
          accent === 'expired'
            ? 'font-medium text-red-500'
            : accent === 'strong'
              ? 'font-semibold text-[hsl(var(--foreground))]'
              : 'font-medium text-[hsl(var(--foreground))]'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function QuoteSection({
  rfq,
  defaultSupplierName,
  canEdit,
  onSaved,
}: {
  rfq: RFQ;
  defaultSupplierName: string;
  canEdit: boolean;
  onSaved: (updated: RFQ) => void;
}) {
  const quote = rfq.quote ?? null;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [supplierNameInput, setSupplierNameInput] = useState('');
  const [unitPriceInput, setUnitPriceInput] = useState('');
  const [totalPriceInput, setTotalPriceInput] = useState('');
  const [totalEdited, setTotalEdited] = useState(false);
  const [currency, setCurrency] = useState<string>('TND');
  const [deliveryInput, setDeliveryInput] = useState('');
  const [leadTimeInput, setLeadTimeInput] = useState('');
  const [paymentTermsInput, setPaymentTermsInput] = useState('');
  const [certifications, setCertifications] = useState<string[]>([]);
  const [certInput, setCertInput] = useState('');
  const [validUntilInput, setValidUntilInput] = useState('');
  const [notesInput, setNotesInput] = useState('');

  function startEditing() {
    setSupplierNameInput(quote?.supplierName ?? defaultSupplierName);
    setUnitPriceInput(quote ? String(quote.unitPrice) : '');
    setTotalPriceInput(quote ? String(quote.totalPrice) : '');
    // Editing an existing quote means the total was already set manually.
    setTotalEdited(true);
    setCurrency(quote?.currency ?? 'TND');
    setDeliveryInput(quote?.deliveryTimeDays != null ? String(quote.deliveryTimeDays) : '');
    setLeadTimeInput(quote?.leadTimeDays != null ? String(quote.leadTimeDays) : '');
    setPaymentTermsInput(quote?.paymentTerms ?? '');
    setCertifications(quote?.certifications ?? []);
    setCertInput('');
    setValidUntilInput(quote?.validUntil ? String(quote.validUntil).slice(0, 10) : '');
    setNotesInput(quote?.notes ?? '');
    setFormError('');
    setEditing(true);
  }

  function handleUnitPriceChange(value: string) {
    setUnitPriceInput(value);
    if (!totalEdited) {
      const unit = parseFloat(value);
      if (value.trim() && Number.isFinite(unit) && typeof rfq.quantity === 'number') {
        setTotalPriceInput((unit * rfq.quantity).toFixed(2));
      } else {
        setTotalPriceInput('');
      }
    }
  }

  function handleTotalPriceChange(value: string) {
    setTotalEdited(true);
    setTotalPriceInput(value);
  }

  function addCertifications(raw: string) {
    const parts = raw.split(',');
    setCertifications((prev) => {
      const next = [...prev];
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed && !next.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
          next.push(trimmed);
        }
      }
      return next.slice(0, 20);
    });
  }

  async function saveQuote() {
    setSaving(true);
    setFormError('');
    try {
      const res = await fetch(`/api/rfqs/${rfq.id}/quote`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierName: supplierNameInput,
          unitPrice: unitPriceInput,
          totalPrice: totalPriceInput,
          currency,
          deliveryTimeDays: deliveryInput === '' ? null : deliveryInput,
          leadTimeDays: leadTimeInput === '' ? null : leadTimeInput,
          paymentTerms: paymentTermsInput,
          certifications,
          validUntil: validUntilInput || null,
          notes: notesInput,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Failed to save quote');
      }
      onSaved(data as RFQ);
      setEditing(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to connect to the server');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[hsl(var(--foreground))]">Supplier quotation</h4>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={startEditing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] px-2.5 py-1.5 text-xs font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))]"
          >
            {quote ? (
              <>
                <Pencil className="h-3 w-3" />
                Edit quote
              </>
            ) : (
              <>
                <Plus className="h-3 w-3" />
                Record quote
              </>
            )}
          </button>
        )}
      </div>

      {quote && !editing && (
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <QuoteField label="Supplier" value={quote.supplierName} />
          <QuoteField
            label="Total price"
            value={formatQuoteAmount(quote.totalPrice, quote.currency)}
            accent="strong"
          />
          <QuoteField
            label="Unit price"
            value={formatQuoteAmount(quote.unitPrice, quote.currency)}
          />
          <QuoteField
            label="Delivery time"
            value={quote.deliveryTimeDays != null ? `${quote.deliveryTimeDays} days` : '—'}
          />
          <QuoteField
            label="Lead time"
            value={quote.leadTimeDays != null ? `${quote.leadTimeDays} days` : '—'}
          />
          <QuoteField label="Payment terms" value={quote.paymentTerms || '—'} />
          <QuoteField
            label="Valid until"
            value={
              quote.validUntil
                ? `${new Date(quote.validUntil).toLocaleDateString()}${isQuoteExpired(quote) ? ' (expired)' : ''}`
                : '—'
            }
            accent={isQuoteExpired(quote) ? 'expired' : undefined}
          />
          {quote.certifications && quote.certifications.length > 0 && (
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Certifications</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {quote.certifications.map((cert) => (
                  <span
                    key={cert}
                    className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs font-medium text-[hsl(var(--foreground))]"
                  >
                    {cert}
                  </span>
                ))}
              </div>
            </div>
          )}
          {quote.notes && (
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-[hsl(var(--muted-foreground))]">
                {quote.notes}
              </p>
            </div>
          )}
        </div>
      )}

      {!quote && !editing && (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          No quote recorded yet.
          {canEdit ? ' Record one once the supplier replies (email, phone…).' : ''}
        </p>
      )}

      {editing && (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Supplier name *
            </label>
            <input
              value={supplierNameInput}
              onChange={(e) => setSupplierNameInput(e.target.value)}
              className={QUOTE_INPUT_CLASS}
              placeholder="e.g. Emballage du Sud SARL"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
                Unit price *
              </label>
              <input
                type="number"
                min={0}
                step="any"
                value={unitPriceInput}
                onChange={(e) => handleUnitPriceChange(e.target.value)}
                className={QUOTE_INPUT_CLASS}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
                Total price *
              </label>
              <input
                type="number"
                min={0}
                step="any"
                value={totalPriceInput}
                onChange={(e) => handleTotalPriceChange(e.target.value)}
                className={QUOTE_INPUT_CLASS}
                placeholder={
                  typeof rfq.quantity === 'number' ? 'auto = unit × qty' : '0.00'
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
                Currency *
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={QUOTE_INPUT_CLASS}
              >
                {QUOTE_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
                Delivery time (days)
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={deliveryInput}
                onChange={(e) => setDeliveryInput(e.target.value)}
                className={QUOTE_INPUT_CLASS}
                placeholder="e.g. 14"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
                Lead time (days)
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={leadTimeInput}
                onChange={(e) => setLeadTimeInput(e.target.value)}
                className={QUOTE_INPUT_CLASS}
                placeholder="e.g. 7"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
                Quote validity
              </label>
              <input
                type="date"
                value={validUntilInput}
                onChange={(e) => setValidUntilInput(e.target.value)}
                className={QUOTE_INPUT_CLASS}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Payment terms
            </label>
            <input
              list="rfq-payment-terms-suggestions"
              value={paymentTermsInput}
              onChange={(e) => setPaymentTermsInput(e.target.value)}
              className={QUOTE_INPUT_CLASS}
              placeholder="e.g. 30 jours fin de mois"
            />
            <datalist id="rfq-payment-terms-suggestions">
              {PAYMENT_TERMS_SUGGESTIONS.map((term) => (
                <option key={term} value={term} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Certifications
            </label>
            <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-2 focus-within:border-[hsl(var(--primary))]">
              <div className="flex flex-wrap items-center gap-1.5">
                {certifications.map((cert) => (
                  <span
                    key={cert}
                    className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs font-medium text-[hsl(var(--foreground))]"
                  >
                    {cert}
                    <button
                      type="button"
                      onClick={() =>
                        setCertifications((prev) => prev.filter((c) => c !== cert))
                      }
                      className="text-[hsl(var(--muted-foreground))] hover:text-red-500"
                      aria-label={`Remove ${cert}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  value={certInput}
                  onChange={(e) => setCertInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      if (certInput.trim()) {
                        addCertifications(certInput);
                        setCertInput('');
                      }
                    }
                  }}
                  onBlur={() => {
                    if (certInput.trim()) {
                      addCertifications(certInput);
                      setCertInput('');
                    }
                  }}
                  placeholder={
                    certifications.length === 0 ? 'e.g. ISO 9001 — Enter or comma to add' : ''
                  }
                  className="min-w-[10rem] flex-1 bg-transparent py-0.5 text-sm text-[hsl(var(--foreground))] outline-none placeholder:text-[hsl(var(--muted-foreground))]"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Notes
            </label>
            <textarea
              rows={3}
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              className={QUOTE_INPUT_CLASS}
              placeholder="Minimum order quantities, surcharges, options…"
            />
          </div>

          {formError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
              <p className="text-sm text-red-500">{formError}</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="flex-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveQuote}
              disabled={
                saving ||
                !supplierNameInput.trim() ||
                !unitPriceInput.trim() ||
                !totalPriceInput.trim()
              }
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              {quote ? 'Update quote' : 'Save quote'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
