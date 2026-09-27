import { randomInt } from 'crypto';

// Alphabet excludes ambiguous characters: I, O, 0, 1.
const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const REFERENCE_SUFFIX_LENGTH = 8;
const REFERENCE_RE = /\bRFQ-[A-HJ-NP-Z2-9]{8}\b/gi;

export function generateRfqReference(): string {
  let suffix = '';
  for (let i = 0; i < REFERENCE_SUFFIX_LENGTH; i += 1) {
    suffix += REFERENCE_ALPHABET[randomInt(0, REFERENCE_ALPHABET.length)];
  }
  return `RFQ-${suffix}`;
}

/** Extracts RFQ references from free text (subject, body), deduped, order preserved. */
export function extractRfqReferences(text: string | null | undefined): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  const refs: string[] = [];
  for (const match of text.matchAll(REFERENCE_RE)) {
    const ref = match[0].toUpperCase();
    if (!seen.has(ref)) {
      seen.add(ref);
      refs.push(ref);
    }
  }
  return refs;
}
