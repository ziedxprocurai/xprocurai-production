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
