/**
 * In-memory store for pending Apollo async phone-number reveals.
 *
 * Apollo's people enrichment endpoint delivers phone numbers asynchronously
 * via a webhook (see `matchApolloPerson` in `@/lib/apollo`). We generate a
 * one-time token per request, hand Apollo a webhook URL containing that
 * token, and stash the result here until the client polls for it.
 *
 * NOTE: this relies on a long-lived Node process (this app is deployed via
 * PM2/Nginx per `deploy/ecosystem.config.js`, not stateless serverless
 * functions), so in-memory storage is safe here. If this app is ever
 * deployed to a serverless platform where each invocation is isolated,
 * replace this with a shared store (e.g. a database table or Redis).
 */

interface PhoneRevealEntry {
  status: 'pending' | 'success' | 'error';
  phoneNumbers?: unknown[];
  error?: string;
  createdAt: number;
}

const TTL_MS = 10 * 60 * 1000; // 10 minutes

const store = new Map<string, PhoneRevealEntry>();

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.createdAt > TTL_MS) {
      store.delete(key);
    }
  }
}

export function createPendingReveal(token: string) {
  cleanup();
  store.set(token, { status: 'pending', createdAt: Date.now() });
}

export function resolvePendingReveal(token: string, phoneNumbers: unknown[]) {
  store.set(token, { status: 'success', phoneNumbers, createdAt: Date.now() });
}

export function failPendingReveal(token: string, error: string) {
  store.set(token, { status: 'error', error, createdAt: Date.now() });
}

export function getPendingReveal(token: string): PhoneRevealEntry | undefined {
  cleanup();
  return store.get(token);
}
