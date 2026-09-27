// Server-only Microsoft Graph client (client-credentials flow, one shared
// mailbox). Never import from client components — it reads secrets.
// Never log tokens or secrets.

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

export const GRAPH_NOT_CONFIGURED_MESSAGE =
  'Email sending is not configured (Microsoft Graph)';

export function isGraphConfigured(): boolean {
  return Boolean(
    process.env.MICROSOFT_TENANT_ID &&
      process.env.MICROSOFT_CLIENT_ID &&
      process.env.MICROSOFT_CLIENT_SECRET &&
      process.env.MICROSOFT_MAILBOX,
  );
}

export class GraphError extends Error {
  status: number;
  code?: string;

  constructor(status: number, code: string | undefined, message: string) {
    super(message);
    this.name = 'GraphError';
    this.status = status;
    this.code = code;
  }
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getGraphToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }
  if (!isGraphConfigured()) {
    throw new Error(GRAPH_NOT_CONFIGURED_MESSAGE);
  }
  const res = await fetch(
    `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        scope:
          process.env.MICROSOFT_GRAPH_SCOPE || 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data?.access_token !== 'string') {
    throw new GraphError(
      res.status,
      typeof data?.error === 'string' ? data.error : undefined,
      'Failed to acquire Microsoft Graph token',
    );
  }
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in || 3600) - 60) * 1000,
  };
  return cachedToken.token;
}

/**
 * Authenticated fetch against Graph v1.0. Always sends
 * `Prefer: IdType="ImmutableId"` — merged with any caller-provided Prefer
 * value — so ids remain stable across folder moves (Drafts → Sent Items).
 * `path` may be relative (`/users/...`) or an absolute URL (e.g. an
 * @odata.nextLink).
 */
export async function graphFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getGraphToken();
  const headers = new Headers(init.headers);
  const existingPrefer = headers.get('Prefer');
  headers.set(
    'Prefer',
    ['IdType="ImmutableId"', existingPrefer].filter(Boolean).join(', '),
  );
  headers.set('Authorization', `Bearer ${token}`);
  const url = path.startsWith('http') ? path : `${GRAPH_BASE}${path}`;
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    let code: string | undefined;
    let message = `Microsoft Graph request failed (${res.status})`;
    try {
      const body = await res.json();
      code = typeof body?.error?.code === 'string' ? body.error.code : undefined;
      if (typeof body?.error?.message === 'string' && body.error.message) {
        message = body.error.message;
      }
    } catch {
      // non-JSON error body — keep the generic message
    }
    throw new GraphError(res.status, code, message);
  }
  return res;
}

export function mailboxPath(): string {
  return `/users/${encodeURIComponent(process.env.MICROSOFT_MAILBOX!)}`;
}
