'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Trash2,
  Eye,
  FileSpreadsheet,
  CloudUpload,
  AlertCircle,
  BarChart3,
  Building2,
} from 'lucide-react';

interface ImportDocument {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  status: 'UPLOADED' | 'PROCESSING' | 'EXTRACTED' | 'FAILED';
  errorMessage?: string;
  createdAt: string;
  _count: { records: number };
}

const STATUS_CONFIG = {
  UPLOADED: { label: 'Uploaded', color: 'text-blue-500', bg: 'bg-blue-500/10', icon: Clock },
  PROCESSING: { label: 'Processing…', color: 'text-amber-500', bg: 'bg-amber-500/10', icon: Loader2 },
  EXTRACTED: { label: 'Ready for Review', color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: CheckCircle },
  FAILED: { label: 'Failed', color: 'text-red-500', bg: 'bg-red-500/10', icon: XCircle },
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ProviderImportContent() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<ImportDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, []);

  async function fetchDocuments() {
    try {
      const res = await fetch('/api/provider-import/documents');
      if (res.ok) setDocuments(await res.json());
    } catch {
      // silently ignore
    } finally {
      setLoadingDocs(false);
    }
  }

  async function handleFile(file: File) {
    setUploadError('');

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xls', 'xlsx'].includes(ext ?? '')) {
      setUploadError('Unsupported file type. Please upload a CSV, XLS, or XLSX file.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File is too large. Maximum size is 10 MB.');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/provider-import/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setUploadError(data?.message || 'Upload failed. Please try again.');
        return;
      }

      await fetchDocuments();

      if (data?.id) {
        router.push(`/dashboard/provider-import/${data.id}`);
      }
    } catch {
      setUploadError('Upload failed. Please check your connection and try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this document and all its extracted records?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/provider-import/documents/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
  }

  const totalExtracted = documents.reduce((sum, d) => sum + (d._count?.records ?? 0), 0);
  const successCount = documents.filter((d) => d.status === 'EXTRACTED').length;

  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="flex items-center gap-3 text-2xl font-bold text-[hsl(var(--foreground))]">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--primary))]/10">
            <FileSpreadsheet className="h-5 w-5 text-[hsl(var(--primary))]" />
          </div>
          Provider Document Import
        </h1>
        <p className="mt-2 text-[hsl(var(--muted-foreground))]">
          Upload CSV or Excel files containing provider/supplier data. AI will automatically extract and structure the information for your review.
        </p>
      </div>

      {/* Stats Row */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Total Uploads', value: documents.length, icon: Upload, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'Ready for Review', value: successCount, icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Records Extracted', value: totalExtracted, icon: BarChart3, color: 'text-violet-500', bg: 'bg-violet-500/10' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{stat.value}</p>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Upload Zone */}
      <div className="mb-8">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          className={`relative rounded-2xl border-2 border-dashed transition-colors ${
            dragOver
              ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5'
              : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'
          } p-10 text-center shadow-sm`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10">
                <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
              </div>
              <div>
                <p className="text-base font-semibold text-[hsl(var(--foreground))]">Uploading & extracting…</p>
                <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">AI is scanning your file. This may take a few seconds.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center gap-4">
                <div className={`flex h-16 w-16 items-center justify-center rounded-full transition-colors ${
                  dragOver ? 'bg-[hsl(var(--primary))]/20' : 'bg-[hsl(var(--muted))]'
                }`}>
                  <CloudUpload className={`h-8 w-8 transition-colors ${dragOver ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))]'}`} />
                </div>
                <div>
                  <p className="text-base font-semibold text-[hsl(var(--foreground))]">
                    Drop your file here, or{' '}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[hsl(var(--primary))] underline-offset-2 hover:underline"
                    >
                      browse
                    </button>
                  </p>
                  <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                    Supports CSV, XLS, XLSX &nbsp;·&nbsp; Max 10 MB
                  </p>
                </div>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80"
                >
                  <Upload className="h-4 w-4" />
                  Select File
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xls,.xlsx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </>
          )}
        </div>

        {uploadError && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-500">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {uploadError}
          </div>
        )}
      </div>

      {/* Documents List */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[hsl(var(--foreground))]">Import History</h2>
          {documents.length > 0 && (
            <span className="rounded-full bg-[hsl(var(--muted))] px-2.5 py-0.5 text-xs font-medium text-[hsl(var(--muted-foreground))]">
              {documents.length} file{documents.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {loadingDocs ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        ) : documents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] py-16 text-center">
            <Building2 className="mx-auto mb-3 h-10 w-10 text-[hsl(var(--muted-foreground))]/40" />
            <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">No files uploaded yet</p>
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]/70">
              Upload a CSV or Excel file to get started
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => {
              const cfg = STATUS_CONFIG[doc.status];
              const StatusIcon = cfg.icon;
              const isDeleting = deletingId === doc.id;

              return (
                <div
                  key={doc.id}
                  className="group rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center gap-4">
                    {/* File icon */}
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--muted))]">
                      <FileText className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-[hsl(var(--foreground))]">{doc.fileName}</p>
                        <span className="rounded-md bg-[hsl(var(--muted))] px-2 py-0.5 text-xs font-medium text-[hsl(var(--muted-foreground))]">
                          {doc.fileType}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[hsl(var(--muted-foreground))]">
                        <span>{formatBytes(doc.fileSize)}</span>
                        <span>{formatDate(doc.createdAt)}</span>
                        {doc.status === 'EXTRACTED' && (
                          <span className="font-medium text-[hsl(var(--foreground))]">
                            {doc._count.records} record{doc._count.records !== 1 ? 's' : ''} extracted
                          </span>
                        )}
                        {doc.status === 'FAILED' && doc.errorMessage && (
                          <span className="text-red-500">{doc.errorMessage}</span>
                        )}
                      </div>
                    </div>

                    {/* Status badge */}
                    <div className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                      <StatusIcon className={`h-3.5 w-3.5 ${doc.status === 'PROCESSING' ? 'animate-spin' : ''}`} />
                      {cfg.label}
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                      {doc.status === 'EXTRACTED' && (
                        <button
                          onClick={() => router.push(`/dashboard/provider-import/${doc.id}`)}
                          className="flex items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Review
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(doc.id)}
                        disabled={isDeleting}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
