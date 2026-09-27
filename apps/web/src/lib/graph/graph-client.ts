// Server-only Microsoft Graph client (client-credentials flow, one shared
// mailbox). Never import from client components — it reads secrets.
// Never log tokens or secrets.

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

export const GRAPH_NOT_CONFIGURED_MESSAGE =
  'Email sending is not configured (Microsoft Graph)';

/** Trimmed env read — Netlify/env vars occasionally carry stray whitespace. */
export function graphEnv(name: string): string {
  return process.env[name]?.trim() || '';
}

export function graphMailbox(): string {
  return graphEnv('MICROSOFT_MAILBOX');
}

export function isGraphConfigured(): boolean {
  return Boolean(
    graphEnv('MICROSOFT_TENANT_ID') &&
      graphEnv('MICROSOFT_CLIENT_ID') &&
      graphEnv('MICROSOFT_CLIENT_SECRET') &&
      graphMailbox(),
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

export interface JwtClaims {
  appid?: string;
  azp?: string;
  oid?: string;
  tid?: string;
  aud?: string;
  roles?: string[];
}

/** Best-effort decode of a JWT's payload — no signature verification,
 * diagnostics only. Returns {} on malformed input. */
export function decodeJwtClaims(token: string): JwtClaims {
  try {
    const segment = token.split('.')[1];
    if (!segment) return {};
    const parsed = JSON.parse(
      Buffer.from(segment.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    );
    if (typeof parsed !== 'object' || parsed === null) return {};
    const claims: JwtClaims = {};
    if (typeof parsed.appid === 'string') claims.appid = parsed.appid;
    if (typeof parsed.azp === 'string') claims.azp = parsed.azp;
    if (typeof parsed.oid === 'string') claims.oid = parsed.oid;
    if (typeof parsed.tid === 'string') claims.tid = parsed.tid;
    if (typeof parsed.aud === 'string') claims.aud = parsed.aud;
    if (Array.isArray(parsed.roles)) claims.roles = parsed.roles;
    return claims;
  } catch {
    return {};
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
  const tenantId = graphEnv('MICROSOFT_TENANT_ID');
  const clientId = graphEnv('MICROSOFT_CLIENT_ID');
  const secret = graphEnv('MICROSOFT_CLIENT_SECRET');
  const scope = graphEnv('MICROSOFT_GRAPH_SCOPE') || 'https://graph.microsoft.com/.default';
  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: secret,
        scope,
        grant_type: 'client_credentials',
      }),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data?.access_token !== 'string') {
    console.error(
      '[graph] token acquisition failed',
      JSON.stringify({
        status: res.status,
        error: data?.error,
        error_description: data?.error_description,
        error_codes: data?.error_codes,
        correlation_id: data?.correlation_id,
      }),
    );
    throw new GraphError(
      res.status,
      typeof data?.error === 'string' ? data.error : undefined,
      'Failed to acquire Microsoft Graph token',
    );
  }
  // TEMP-DIAG: remove after verification (console.error because the repo's
  // no-console rule only allows warn/error)
  console.error(
    '[graph] TEMP-DIAG token',
    JSON.stringify({
      clientId,
      tenantId,
      mailbox: graphMailbox(),
      scope,
      secretPresent: Boolean(secret),
      claims: decodeJwtClaims(data.access_token),
    }),
  );
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
    const text = await res.text().catch(() => '');
    // TEMP-DIAG: remove after verification
    console.error(
      '[graph] TEMP-DIAG request failed',
      JSON.stringify({
        method: init.method || 'GET',
        url,
        status: res.status,
        requestId: res.headers.get('request-id'),
        clientRequestId: res.headers.get('client-request-id'),
        body: text.slice(0, 4000),
      }),
    );
    let code: string | undefined;
    let message = `Microsoft Graph request failed (${res.status})`;
    try {
      const body = JSON.parse(text);
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
  return `/users/${encodeURIComponent(graphMailbox())}`;
}
