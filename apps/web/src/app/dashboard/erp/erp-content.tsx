'use client';

import { useState, useEffect } from 'react';
import {
  Plug,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Database,
  Key,
  Lock,
  Trash2,
  Save,
} from 'lucide-react';

interface ERPConnection {
  id: string;
  erpSystem: 'SAP' | 'ORACLE_NETSUITE' | 'MICROSOFT_DYNAMICS_365';
  connectionString?: string;
  apiKey?: string;
  credentials?: string;
  isActive: boolean;
  createdAt: string;
  company: {
    id: string;
    legalName: string;
  };
}

const ERP_SYSTEMS = [
  {
    id: 'SAP',
    name: 'SAP',
    description: 'Enterprise resource planning software for large organizations',
    icon: '🔷',
  },
  {
    id: 'ORACLE_NETSUITE',
    name: 'Oracle NetSuite',
    description: 'Cloud-based business management suite',
    icon: '☁️',
  },
  {
    id: 'MICROSOFT_DYNAMICS_365',
    name: 'Microsoft Dynamics 365',
    description: 'Intelligent business applications',
    icon: '🔶',
  },
] as const;

export function ERPContent() {
  const [erpConnection, setErpConnection] = useState<ERPConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSystem, setSelectedSystem] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    connectionString: '',
    apiKey: '',
    credentials: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [company, setCompany] = useState<any>(null);

  const isSupplier = company?.roles?.includes('SUPPLIER');

  useEffect(() => {
    fetchCompanyAndERP();
  }, []);

  async function fetchCompanyAndERP() {
    try {
      setLoading(true);
      const companyRes = await fetch('/api/companies/me');
      if (companyRes.ok) {
        const companyData = await companyRes.json();
        setCompany(companyData);

        if (companyData?.roles?.includes('SUPPLIER')) {
          await fetchERPConnection();
        }
      }
    } catch {
      setError('Unable to connect to the server');
    } finally {
      setLoading(false);
    }
  }

  async function fetchERPConnection() {
    try {
      const res = await fetch('/api/erp');
      if (res.ok) {
        const data = await res.json();
        setErpConnection(data);
        if (data) {
          setFormData({
            connectionString: data.connectionString || '',
            apiKey: data.apiKey || '',
            credentials: data.credentials || '',
          });
        }
      }
    } catch {
      setError('Failed to load ERP connection');
    }
  }

  function openSetupForm(systemId: string) {
    setSelectedSystem(systemId);
    setShowForm(true);
    setError('');
  }

  function closeForm() {
    setShowForm(false);
    setSelectedSystem('');
    setFormData({
      connectionString: '',
      apiKey: '',
      credentials: '',
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const payload = erpConnection
        ? formData
        : { erpSystem: selectedSystem, ...formData };

      const url = '/api/erp';
      const method = erpConnection ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await fetchERPConnection();
        closeForm();
      } else {
        const data = await res.json();
        setError(data.message || 'Failed to save ERP connection');
      }
    } catch {
      setError('Unable to connect to the server');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this ERP connection?')) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/erp', { method: 'DELETE' });
      if (res.ok) {
        setErpConnection(null);
        setFormData({
          connectionString: '',
          apiKey: '',
          credentials: '',
        });
      } else {
        setError('Failed to delete ERP connection');
      }
    } catch {
      setError('Unable to connect to the server');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isSupplier) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <Plug className="mx-auto h-12 w-12 text-[hsl(var(--muted-foreground))]" />
          <h2 className="mt-4 text-xl font-semibold text-[hsl(var(--foreground))]">
            ERP Integration
          </h2>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            Only suppliers can connect ERP systems. Please update your company role to access this feature.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading ERP connection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] p-6">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">ERP Integration</h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Connect your ERP system to sync products and inventory
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {/* Current Connection Status */}
        {erpConnection ? (
          <div className="mb-8 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">
                    {ERP_SYSTEMS.find((s) => s.id === erpConnection.erpSystem)?.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">
                      {ERP_SYSTEMS.find((s) => s.id === erpConnection.erpSystem)?.name}
                    </h3>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                      Connected on {new Date(erpConnection.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-[hsl(var(--muted-foreground))]">Status:</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        erpConnection.isActive
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : 'bg-amber-500/10 text-amber-500'
                      }`}
                    >
                      {erpConnection.isActive ? (
                        <>
                          <CheckCircle className="h-3 w-3" />
                          Active
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3 w-3" />
                          Inactive
                        </>
                      )}
                    </span>
                  </div>

                  {erpConnection.connectionString && (
                    <div className="flex items-center gap-2 text-sm">
                      <Database className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                      <span className="text-[hsl(var(--muted-foreground))]">Connection configured</span>
                    </div>
                  )}

                  {erpConnection.apiKey && (
                    <div className="flex items-center gap-2 text-sm">
                      <Key className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                      <span className="text-[hsl(var(--muted-foreground))]">API key configured</span>
                    </div>
                  )}

                  {erpConnection.credentials && (
                    <div className="flex items-center gap-2 text-sm">
                      <Lock className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                      <span className="text-[hsl(var(--muted-foreground))]">Credentials configured</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedSystem(erpConnection.erpSystem);
                    setShowForm(true);
                  }}
                  className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))]"
                >
                  <Save className="h-4 w-4" />
                  Update
                </button>
                <button
                  onClick={handleDelete}
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Disconnect
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* ERP System Selection */}
            <div className="mb-6">
              <h2 className="mb-4 text-lg font-semibold text-[hsl(var(--foreground))]">
                Select Your ERP System
              </h2>
              <div className="grid gap-4 sm:grid-cols-3">
                {ERP_SYSTEMS.map((system) => (
                  <button
                    key={system.id}
                    onClick={() => openSetupForm(system.id)}
                    className="group rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-left transition-all hover:border-[hsl(var(--primary))] hover:shadow-lg"
                  >
                    <div className="mb-3 text-4xl">{system.icon}</div>
                    <h3 className="mb-2 text-lg font-semibold text-[hsl(var(--foreground))] group-hover:text-[hsl(var(--primary))]">
                      {system.name}
                    </h3>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                      {system.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Info Box */}
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 flex-shrink-0 text-blue-500" />
                <div>
                  <h4 className="mb-1 text-sm font-medium text-blue-500">Placeholder Integration</h4>
                  <p className="text-sm text-blue-500/80">
                    This is a placeholder for ERP integration. The connection details you provide will be stored
                    but not actively used until the full integration is implemented.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Connection Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-xl">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-[hsl(var(--foreground))]">
                  {erpConnection ? 'Update' : 'Connect'}{' '}
                  {ERP_SYSTEMS.find((s) => s.id === selectedSystem)?.name}
                </h2>
                <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                  Enter your connection details below (placeholder)
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
                    Connection String
                  </label>
                  <input
                    type="text"
                    value={formData.connectionString}
                    onChange={(e) => setFormData({ ...formData, connectionString: e.target.value })}
                    className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
                    placeholder="e.g., Server=myserver;Database=mydb;..."
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
                    placeholder="Enter your API key"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]">
                    Credentials (JSON)
                  </label>
                  <textarea
                    value={formData.credentials}
                    onChange={(e) => setFormData({ ...formData, credentials: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
                    placeholder='{"username": "user", "password": "pass"}'
                  />
                </div>

                {error && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                    <p className="text-sm text-red-500">{error}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="flex-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[hsl(var(--primary))]/90 disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>{erpConnection ? 'Update Connection' : 'Connect'}</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
