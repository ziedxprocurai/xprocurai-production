// Shared constants for the RFQ workflow.
// Client-safe: no Node-only APIs or secrets may be referenced from this file.

export const RFQ_CATEGORIES = [
  'Matières premières',
  'Emballage',
  'Fournitures de bureau',
  'Services',
  'Pièces de rechange',
  'Équipements industriels',
  'Informatique & télécoms',
  'Maintenance (MRO)',
  'Transport & logistique',
  'Produits chimiques',
  'Énergie & utilités',
  'Autre',
] as const;

export const UNIT_OF_MEASURE_OPTIONS = [
  { value: 'PIECE', label: 'Pièce / Unité' },
  { value: 'KG', label: 'Kg' },
  { value: 'TONNE', label: 'Tonne' },
  { value: 'METRE', label: 'Mètre' },
  { value: 'LITRE', label: 'Litre' },
  { value: 'PALETTE', label: 'Palette' },
  { value: 'HOUR', label: 'Heure' },
  { value: 'FLAT_RATE', label: 'Forfait' },
] as const;

export type RFQUnitOfMeasureValue = (typeof UNIT_OF_MEASURE_OPTIONS)[number]['value'];

export function unitLabel(value?: string | null): string {
  return UNIT_OF_MEASURE_OPTIONS.find((o) => o.value === value)?.label ?? '';
}

export const QUOTE_CURRENCIES = ['TND', 'EUR', 'USD', 'GBP', 'MAD', 'DZD', 'CHF', 'CAD'] as const;

export type QuoteCurrency = (typeof QUOTE_CURRENCIES)[number];

export const PAYMENT_TERMS_SUGGESTIONS = [
  'Comptant à la commande',
  '30 jours fin de mois',
  '60 jours date de facture',
  '50% acompte / 50% à la livraison',
  '90 jours',
] as const;

export const MAX_RFQ_ATTACHMENTS = 10;
export const MAX_RFQ_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export const ALLOWED_RFQ_ATTACHMENT_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'csv',
  'ppt',
  'pptx',
  'txt',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'dwg',
  'dxf',
  'step',
  'stp',
  'igs',
  'iges',
  'zip',
] as const;

export function getFileExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  if (idx < 0 || idx === name.length - 1) return '';
  return name.slice(idx + 1).toLowerCase();
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'] as const;
  let value = bytes;
  let unit = -1;
  do {
    value /= 1024;
    unit += 1;
  } while (value >= 1024 && unit < units.length - 1);
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[unit]}`;
}

export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  const cleaned = base
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  return (cleaned || 'file').slice(0, 120);
}
