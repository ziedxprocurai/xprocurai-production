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
            {currentRFQs.map((rfq) => {
              const StatusIcon = STATUS_CONFIG[rfq.status].icon;
              return (
                <div
                  key={rfq.id}
                  className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 transition-shadow hover:shadow-lg"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-3 flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">
                            {rfq.title}
                          </h3>
                          {rfq.description && (
                            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                              {rfq.description}
                            </p>
                          )}
                        </div>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${STATUS_CONFIG[rfq.status].color}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {STATUS_CONFIG[rfq.status].label}
                        </span>
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
                          <span className="text-[hsl(var(--foreground))]">
                            {activeTab === 'sent'
                              ? rfq.supplier?.legalName
                              : rfq.buyer?.legalName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                          <span>Qty: {rfq.quantity}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                          <Calendar className="h-4 w-4" />
                          {new Date(rfq.createdAt).toLocaleDateString()}
                        </div>
                      </div>

                      <button
                        onClick={() => openDetailModal(rfq)}
                        className="text-sm font-medium text-[hsl(var(--primary))] hover:underline"
                      >
                        View Details →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
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
                        {activeTab === 'sent'
                          ? selectedRFQ.supplier?.legalName
                          : selectedRFQ.buyer?.legalName}
                      </span>
                    </div>
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
