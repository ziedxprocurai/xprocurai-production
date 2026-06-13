'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Loader2,
  FileText,
  Building2,
  Mail,
  Phone,
  MapPin,
  Globe,
  Receipt,
  User,
  StickyNote,
  Edit2,
  Check,
  X,
  AlertCircle,
  Download,
  SquareCheckBig,
  Square,
} from 'lucide-react';

interface ProviderRecord {
  id: string;
  companyName: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  country: string | null;
  vatId: string | null;
  website: string | null;
  notes: string | null;
  status: 'PENDING' | 'IMPORTED' | 'SKIPPED';
  isSelected: boolean;
}

interface ImportDocument {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: string;
  errorMessage?: string;
  createdAt: string;
  records: ProviderRecord[];
  _count: { records: number };
}

interface EditingCell {
  recordId: string;
  field: keyof ProviderRecord;
}

const FIELDS: { key: keyof ProviderRecord; label: string; icon: React.ElementType; placeholder: string }[] = [
  { key: 'companyName', label: 'Company', icon: Building2, placeholder: 'Company name' },
  { key: 'contactPerson', label: 'Contact', icon: User, placeholder: 'Contact person' },
  { key: 'email', label: 'Email', icon: Mail, placeholder: 'email@example.com' },
  { key: 'phone', label: 'Phone', icon: Phone, placeholder: '+1 234 567 8900' },
  { key: 'address', label: 'Address', icon: MapPin, placeholder: 'Street address' },
  { key: 'country', label: 'Country', icon: Globe, placeholder: 'Country' },
  { key: 'vatId', label: 'VAT/Tax ID', icon: Receipt, placeholder: 'VAT or tax ID' },
  { key: 'website', label: 'Website', icon: Globe, placeholder: 'https://...' },
  { key: 'notes', label: 'Notes', icon: StickyNote, placeholder: 'Additional notes' },
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ReviewContent({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [document, setDocument] = useState<ImportDocument | null>(null);
  const [records, setRecords] = useState<ProviderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; message: string } | null>(null);
  const [importError, setImportError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/provider-import/documents/${documentId}`);
        if (!res.ok) {
          setError('Document not found or you do not have access to it.');
          return;
        }
        const data: ImportDocument = await res.json();
        setDocument(data);
        setRecords(data.records ?? []);
      } catch {
        setError('Failed to load document.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [documentId]);

  const startEdit = useCallback((recordId: string, field: keyof ProviderRecord, currentValue: string | null) => {
    setEditingCell({ recordId, field });
    setEditValue(currentValue ?? '');
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingCell) return;
    const { recordId, field } = editingCell;
    setSavingCell(`${recordId}-${field}`);
    try {
      const res = await fetch(`/api/provider-import/records/${recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: editValue || null }),
      });
      if (res.ok) {
        const updated: ProviderRecord = await res.json();
        setRecords((prev) => prev.map((r) => (r.id === recordId ? { ...r, [field]: updated[field] } : r)));
      }
    } finally {
      setSavingCell(null);
      setEditingCell(null);
      setEditValue('');
    }
  }, [editingCell, editValue]);

  const toggleSelect = useCallback(async (recordId: string, current: boolean) => {
    setRecords((prev) => prev.map((r) => (r.id === recordId ? { ...r, isSelected: !current } : r)));
    await fetch(`/api/provider-import/records/${recordId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isSelected: !current }),
    });
  }, []);

  const toggleSelectAll = useCallback(async () => {
    const pending = records.filter((r) => r.status === 'PENDING');
    const allSelected = pending.every((r) => r.isSelected);
    const newVal = !allSelected;
    setRecords((prev) =>
      prev.map((r) => (r.status === 'PENDING' ? { ...r, isSelected: newVal } : r)),
    );
    await Promise.all(
      pending.map((r) =>
        fetch(`/api/provider-import/records/${r.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isSelected: newVal }),
        }),
      ),
    );
  }, [records]);

  const handleImport = useCallback(async () => {
    const selectedIds = records.filter((r) => r.isSelected && r.status === 'PENDING').map((r) => r.id);
    if (selectedIds.length === 0) return;

    setImporting(true);
    setImportError('');
    setImportResult(null);

    try {
      const res = await fetch(`/api/provider-import/documents/${documentId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordIds: selectedIds }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setImportError(data?.message || 'Import failed.');
        return;
      }
      setImportResult(data);
      const res2 = await fetch(`/api/provider-import/documents/${documentId}`);
      if (res2.ok) {
        const updated: ImportDocument = await res2.json();
        setRecords(updated.records ?? []);
      }
    } catch {
      setImportError('Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  }, [records, documentId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-[hsl(var(--primary))]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <p className="text-base font-semibold text-[hsl(var(--foreground))]">{error}</p>
          <button
            onClick={() => router.push('/dashboard/provider-import')}
            className="mt-4 text-sm text-[hsl(var(--primary))] hover:underline"
          >
            ← Back to imports
          </button>
        </div>
      </div>
    );
  }

  const pendingRecords = records.filter((r) => r.status === 'PENDING');
  const selectedCount = pendingRecords.filter((r) => r.isSelected).length;
  const importedCount = records.filter((r) => r.status === 'IMPORTED').length;
  const allPendingSelected = pendingRecords.length > 0 && pendingRecords.every((r) => r.isSelected);

  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/dashboard/provider-import')}
          className="mb-4 flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to imports
        </button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--primary))]/10">
              <FileText className="h-5 w-5 text-[hsl(var(--primary))]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">{document?.fileName}</h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                {document?.fileType} &nbsp;·&nbsp; {formatBytes(document?.fileSize ?? 0)} &nbsp;·&nbsp;{' '}
                {records.length} record{records.length !== 1 ? 's' : ''} extracted
              </p>
            </div>
          </div>

          {pendingRecords.length > 0 && !importResult && (
            <button
              onClick={handleImport}
              disabled={importing || selectedCount === 0}
              className="flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Import {selectedCount > 0 ? `${selectedCount} Selected` : 'Selected'}
            </button>
          )}
        </div>
      </div>

      {/* Import result banner */}
      {importResult && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4">
          <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
          <div>
            <p className="font-semibold text-emerald-600 dark:text-emerald-400">{importResult.message}</p>
            <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">
              {importResult.skipped > 0 && `${importResult.skipped} record${importResult.skipped !== 1 ? 's' : ''} skipped.`}
              {' '}You can find imported providers in your provider database.
            </p>
          </div>
        </div>
      )}

      {importError && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-500">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {importError}
        </div>
      )}

      {/* Summary chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { label: `${pendingRecords.length} Pending`, color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', show: pendingRecords.length > 0 },
          { label: `${importedCount} Imported`, color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', show: importedCount > 0 },
          { label: `${selectedCount} Selected`, color: 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]', show: selectedCount > 0 },
        ]
          .filter((c) => c.show)
          .map((chip) => (
            <span key={chip.label} className={`rounded-full px-3 py-1 text-xs font-semibold ${chip.color}`}>
              {chip.label}
            </span>
          ))}
      </div>

      {records.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] py-16 text-center">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-[hsl(var(--muted-foreground))]/40" />
          <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">No records extracted</p>
        </div>
      ) : (
        /* Table */
        <div className="overflow-x-auto rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40">
                <th className="w-10 px-4 py-3">
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center justify-center text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--primary))]"
                    title={allPendingSelected ? 'Deselect all' : 'Select all'}
                  >
                    {allPendingSelected ? (
                      <SquareCheckBig className="h-4.5 w-4.5 text-[hsl(var(--primary))]" />
                    ) : (
                      <Square className="h-4.5 w-4.5" />
                    )}
                  </button>
                </th>
                {FIELDS.map((f) => (
                  <th
                    key={f.key}
                    className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]"
                  >
                    <span className="flex items-center gap-1.5">
                      <f.icon className="h-3.5 w-3.5" />
                      {f.label}
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {records.map((record) => {
                const isPending = record.status === 'PENDING';
                const isImported = record.status === 'IMPORTED';

                return (
                  <tr
                    key={record.id}
                    className={`transition-colors ${
                      isImported
                        ? 'bg-emerald-500/5 opacity-70'
                        : record.status === 'SKIPPED'
                          ? 'opacity-40'
                          : record.isSelected
                            ? 'bg-[hsl(var(--primary))]/5'
                            : ''
                    } hover:bg-[hsl(var(--muted))]/30`}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3">
                      {isPending && (
                        <button
                          onClick={() => toggleSelect(record.id, record.isSelected)}
                          className="flex items-center justify-center text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--primary))]"
                        >
                          {record.isSelected ? (
                            <SquareCheckBig className="h-4 w-4 text-[hsl(var(--primary))]" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </td>

                    {/* Editable fields */}
                    {FIELDS.map((f) => {
                      const cellKey = `${record.id}-${f.key}`;
                      const isEditing =
                        editingCell?.recordId === record.id && editingCell?.field === f.key;
                      const isSaving = savingCell === cellKey;
                      const value = record[f.key] as string | null;

                      return (
                        <td key={f.key} className="max-w-[180px] px-3 py-2.5">
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <input
                                autoFocus
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEdit();
                                  if (e.key === 'Escape') cancelEdit();
                                }}
                                placeholder={f.placeholder}
                                className="w-full rounded-lg border border-[hsl(var(--primary))] bg-[hsl(var(--background))] px-2 py-1 text-xs text-[hsl(var(--foreground))] outline-none ring-1 ring-[hsl(var(--primary))]"
                              />
                              <button
                                onClick={saveEdit}
                                disabled={isSaving}
                                className="shrink-0 rounded p-1 text-emerald-500 hover:bg-emerald-500/10"
                              >
                                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="shrink-0 rounded p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => isPending && startEdit(record.id, f.key, value)}
                              disabled={!isPending}
                              title={isPending ? 'Click to edit' : undefined}
                              className={`group flex w-full items-center justify-between gap-1 rounded-lg px-2 py-1 text-left text-xs transition-colors ${
                                isPending ? 'hover:bg-[hsl(var(--muted))]' : 'cursor-default'
                              }`}
                            >
                              <span className={`truncate ${value ? 'text-[hsl(var(--foreground))]' : 'italic text-[hsl(var(--muted-foreground))]/60'}`}>
                                {value || '—'}
                              </span>
                              {isPending && (
                                <Edit2 className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]/40 opacity-0 transition-opacity group-hover:opacity-100" />
                              )}
                            </button>
                          )}
                        </td>
                      );
                    })}

                    {/* Status */}
                    <td className="px-4 py-2.5">
                      {isImported ? (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-500">
                          <CheckCircle className="h-3.5 w-3.5" />
                          Imported
                        </span>
                      ) : record.status === 'SKIPPED' ? (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))]">
                          <XCircle className="h-3.5 w-3.5" />
                          Skipped
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-amber-500">Pending</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Bottom import bar (sticky) */}
      {pendingRecords.length > 0 && !importResult && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-md">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            <span className="font-semibold text-[hsl(var(--foreground))]">{selectedCount}</span> of{' '}
            {pendingRecords.length} record{pendingRecords.length !== 1 ? 's' : ''} selected for import
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className="text-sm text-[hsl(var(--primary))] hover:underline"
            >
              {allPendingSelected ? 'Deselect all' : 'Select all'}
            </button>
            <button
              onClick={handleImport}
              disabled={importing || selectedCount === 0}
              className="flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Import {selectedCount > 0 ? `${selectedCount} Selected` : 'Selected'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
