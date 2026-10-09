'use client';

import { useId, useRef, useState } from 'react';
import { FileText, Trash2, Upload } from 'lucide-react';
import {
  ALLOWED_RFQ_ATTACHMENT_EXTENSIONS,
  MAX_RFQ_ATTACHMENT_BYTES,
  MAX_RFQ_ATTACHMENTS,
  RFQ_CATEGORIES,
  UNIT_OF_MEASURE_OPTIONS,
  formatFileSize,
  getFileExtension,
  type RFQUnitOfMeasureValue,
} from '@/lib/rfq-constants';

export interface RfqFormValues {
  title: string;
  category: string;
  itemName: string;
  description: string;
  quantity: number | '';
  unitOfMeasure: RFQUnitOfMeasureValue;
}

const INPUT_CLASS =
  'w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20';
const LABEL_CLASS = 'mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]';

/** Core procurement fields shared by product and discovery RFQs. */
export function RfqFormFields({
  value,
  onChange,
  disabled = false,
}: {
  value: RfqFormValues;
  onChange: (value: RfqFormValues) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <fieldset disabled={disabled} className="space-y-4">
      <div>
        <label htmlFor={`${id}-title`} className={LABEL_CLASS}>RFQ Title *</label>
        <input id={`${id}-title`} required maxLength={300} value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          className={INPUT_CLASS} placeholder="e.g. Achat Cartons Emballage Q3" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-category`} className={LABEL_CLASS}>Category / Famille d&apos;achat *</label>
          <select id={`${id}-category`} required value={value.category}
            onChange={(e) => onChange({ ...value, category: e.target.value })} className={INPUT_CLASS}>
            <option value="" disabled>Select a category</option>
            {RFQ_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-item`} className={LABEL_CLASS}>Item / Service Name *</label>
          <input id={`${id}-item`} required maxLength={200} value={value.itemName}
            onChange={(e) => onChange({ ...value, itemName: e.target.value })}
            className={INPUT_CLASS} placeholder="e.g. Carton Américain 30x40" />
        </div>
      </div>
      <div>
        <label htmlFor={`${id}-specifications`} className={LABEL_CLASS}>Detailed Specifications *</label>
        <textarea id={`${id}-specifications`} required maxLength={20000} rows={5} value={value.description}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
          className={INPUT_CLASS} placeholder="e.g. Double cannelure, kraft, imprimé 2 couleurs" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-quantity`} className={LABEL_CLASS}>Quantity *</label>
          <input id={`${id}-quantity`} type="number" required min={1} max={2147483647} step={1}
            value={value.quantity} onChange={(e) => onChange({
              ...value, quantity: e.target.value === '' ? '' : Number(e.target.value),
            })} className={INPUT_CLASS} />
        </div>
        <div>
          <label htmlFor={`${id}-unit`} className={LABEL_CLASS}>Unit of Measure / Unité *</label>
          <select id={`${id}-unit`} required value={value.unitOfMeasure}
            onChange={(e) => onChange({ ...value, unitOfMeasure: e.target.value as RFQUnitOfMeasureValue })}
            className={INPUT_CLASS}>
            {UNIT_OF_MEASURE_OPTIONS.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}
          </select>
        </div>
      </div>
    </fieldset>
  );
}

export function RfqAttachmentsField({
  files,
  onChange,
  disabled = false,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);

  function addFiles(incoming: FileList) {
    if (disabled) return;
    const next = [...files];
    const rejected: string[] = [];
    for (const file of Array.from(incoming)) {
      if (!(ALLOWED_RFQ_ATTACHMENT_EXTENSIONS as readonly string[]).includes(getFileExtension(file.name))) {
        rejected.push(`${file.name}: unsupported file type`);
      } else if (file.size <= 0 || file.size > MAX_RFQ_ATTACHMENT_BYTES) {
        rejected.push(`${file.name}: must be between 1 B and ${formatFileSize(MAX_RFQ_ATTACHMENT_BYTES)}`);
      } else if (!next.some((existing) => existing.name === file.name && existing.size === file.size)) {
        if (next.length >= MAX_RFQ_ATTACHMENTS) {
          rejected.push(`Maximum ${MAX_RFQ_ATTACHMENTS} attachments per RFQ`);
        } else {
          next.push(file);
        }
      }
    }
    onChange(next);
    setError(rejected.join(' · '));
  }

  return (
    <fieldset disabled={disabled}>
      <legend className={LABEL_CLASS}>Attachments</legend>
      <button type="button" onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          addFiles(e.dataTransfer.files);
        }}
        aria-describedby={`${id}-help`}
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          dragActive ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5'
            : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/50'
        }`}>
        <Upload className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
        <span className="text-sm text-[hsl(var(--foreground))]">Drop files here or browse</span>
        <span id={`${id}-help`} className="text-xs text-[hsl(var(--muted-foreground))]">
          Technical drawings, cahier des charges, or previous samples. Up to {MAX_RFQ_ATTACHMENTS} files · {formatFileSize(MAX_RFQ_ATTACHMENT_BYTES)} each · PDF, Office, images, CAD, ZIP
        </span>
      </button>
      <input ref={inputRef} type="file" multiple className="hidden" aria-label="Upload RFQ attachments"
        accept={ALLOWED_RFQ_ATTACHMENT_EXTENSIONS.map((ext) => `.${ext}`).join(',')}
        onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
      {files.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.size}`} className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-3 py-2">
              <FileText className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
              <span className="min-w-0 flex-1 truncate text-sm text-[hsl(var(--foreground))]" title={file.name}>{file.name}</span>
              <span className="shrink-0 text-xs text-[hsl(var(--muted-foreground))]">{formatFileSize(file.size)}</span>
              <button type="button" aria-label={`Remove ${file.name}`} onClick={() => {
                onChange(files.filter((_, i) => i !== index)); setError('');
              }} className="rounded-md p-1 text-[hsl(var(--muted-foreground))] hover:bg-red-500/10 hover:text-red-500">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-red-500">{error}</p>}
    </fieldset>
  );
}