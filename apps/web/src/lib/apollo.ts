/**
 * Apollo.io API client (server-side only).
 *
 * SECURITY / DEPRECATION NOTICE (per Apollo.io docs):
 * "Including API keys in URL parameters will be deprecated soon. Please
 * include your API key in the request headers instead for enhanced security."
 *
 * This client ALWAYS sends the API key via the `x-api-key` request header
 * and NEVER appends it as a URL/query parameter. The key is read from the
 * server-only `APOLLO_API_KEY` environment variable and must never be
 * exposed to the browser (do not prefix it with NEXT_PUBLIC_).
 *
 * Docs:
 * - People search:        https://docs.apollo.io/reference/people-api-search
 * - Organization search:  https://docs.apollo.io/reference/organization-search
 * - People enrichment:    https://docs.apollo.io/reference/people-enrichment
 * - API usage stats:      https://docs.apollo.io/reference/view-api-usage-stats
 */

const APOLLO_API_BASE = 'https://api.apollo.io/api/v1';

function getApolloApiKey(): string {
  const key = process.env.APOLLO_API_KEY;
  if (!key) {
    throw new Error('APOLLO_API_KEY is not configured on the server.');
  }
  return key;
}

async function apolloRequest<T = any>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${APOLLO_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      Accept: 'application/json',
      // API key is sent via header ONLY, never as a URL parameter.
      'x-api-key': getApolloApiKey(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const errJson = await res.json();
      detail = errJson?.error || errJson?.message || JSON.stringify(errJson);
    } catch {
      detail = await res.text().catch(() => res.statusText);
    }
    throw new Error(`Apollo API request failed (${res.status}): ${detail}`);
  }

  return res.json() as Promise<T>;
}

export interface ApolloPersonSearchParams {
  q_keywords?: string;
  person_titles?: string[];
  include_similar_titles?: boolean;
  person_locations?: string[];
  person_seniorities?: string[];
  organization_locations?: string[];
  q_organization_domains_list?: string[];
  organization_num_employees_ranges?: string[];
  contact_email_status?: string[];
  'revenue_range[min]'?: number;
  'revenue_range[max]'?: number;
  currently_using_all_of_technology_uids?: string[];
  currently_using_any_of_technology_uids?: string[];
  organization_ids?: string[];
  page?: number;
  per_page?: number;
}

export interface ApolloCompanySearchParams {
  q_organization_name?: string;
  organization_locations?: string[];
  organization_not_locations?: string[];
  organization_num_employees_ranges?: string[];
  q_organization_keyword_tags?: string[];
  currently_using_any_of_technology_uids?: string[];
  currently_using_all_of_technology_uids?: string[];
  'revenue_range[min]'?: number;
  'revenue_range[max]'?: number;
  'latest_funding_amount_range[min]'?: number;
  'latest_funding_amount_range[max]'?: number;
  'total_funding_range[min]'?: number;
  'total_funding_range[max]'?: number;
  'latest_funding_date_range[min]'?: string;
  'latest_funding_date_range[max]'?: string;
  q_organization_job_titles?: string[];
  organization_job_locations?: string[];
  'organization_num_jobs_range[min]'?: number;
  'organization_num_jobs_range[max]'?: number;
  organization_ids?: string[];
  page?: number;
  per_page?: number;
}

/** Search for people (prospects) in the Apollo database. */
export function searchApolloPeople(params: ApolloPersonSearchParams) {
  return apolloRequest('/mixed_people/api_search', { ...params });
}

/** Search for organizations/companies in the Apollo database. */
export function searchApolloCompanies(params: ApolloCompanySearchParams) {
  return apolloRequest('/mixed_companies/search', { ...params });
}

export interface ApolloPersonMatchParams {
  id?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  domain?: string;
  organization_name?: string;
  reveal_personal_emails?: boolean;
  reveal_phone_number?: boolean;
  webhook_url?: string;
}

/**
 * Enrich a single person record - matches the `id` (or name/email/domain)
 * returned by `searchApolloPeople` against Apollo's full profile database.
 * Email reveal is synchronous. Phone reveal is asynchronous: Apollo sends the
 * verified phone numbers to `webhook_url` a few minutes after this call
 * returns, so `webhook_url` is required whenever `reveal_phone_number` is true.
 */
export function matchApolloPerson(params: ApolloPersonMatchParams) {
  return apolloRequest('/people/match', { ...params });
}

/**
 * View this workspace's Apollo API usage stats and rate limits.
 * NOTE: this endpoint requires a Master API Key. If a regular API key is
 * used, Apollo returns a 403/401 - callers should treat that as "unavailable"
 * rather than a hard failure.
 */
export function getApolloUsageStats() {
  return apolloRequest('/usage_stats/api_usage_stats', {});
}
