import { Prisma, LeadSourceName } from '@prisma/client';
import { prisma } from './prisma';

/**
 * xDiscoveryBeta data access layer.
 *
 * The `leadgen` schema lives on the same Supabase Postgres project as the
 * rest of the app, which is already close to its free-tier egress limit.
 * Every query in this file is written to minimize bytes transferred:
 *   - explicit `select` (never fetch full rows / relations we don't render)
 *   - hard-capped, server-enforced pagination
 *   - short-lived in-memory caching for filter facets (distinct sectors,
 *     regions, sizes) so the filter bar doesn't re-scan the table on every
 *     page load
 *   - a single count query re-used for pagination instead of `findMany` +
 *     client-side length checks
 */

export const LEADGEN_PAGE_SIZE = 20;
export const LEADGEN_MAX_PAGE_SIZE = 50;

export interface LeadCompanyFilters {
  keyword?: string;
  sectorLabel?: string;
  city?: string;
  region?: string;
  country?: string;
  sizeRange?: string;
  source?: string;
  hasEmail?: boolean;
  hasPhone?: boolean;
  hasLinkedin?: boolean;
}

export interface LeadPersonFilters {
  keyword?: string;
  jobTitle?: string;
  companyName?: string;
  city?: string;
  region?: string;
  country?: string;
  hasEmail?: boolean;
}

const COMPANY_LIST_SELECT = {
  id: true,
  name: true,
  domain: true,
  sectorCode: true,
  sectorLabel: true,
  sizeRange: true,
  city: true,
  region: true,
  country: true,
  linkedinUrl: true,
  source: true,
  fetchedAt: true,
  _count: { select: { emails: true, phones: true, persons: true } },
} satisfies Prisma.LeadCompanySelect;

export type LeadCompanyListItem = Prisma.LeadCompanyGetPayload<{ select: typeof COMPANY_LIST_SELECT }>;

function clampPageSize(pageSize?: number) {
  if (!pageSize || Number.isNaN(pageSize)) return LEADGEN_PAGE_SIZE;
  return Math.max(1, Math.min(LEADGEN_MAX_PAGE_SIZE, Math.floor(pageSize)));
}

function buildCompanyWhere(filters: LeadCompanyFilters): Prisma.LeadCompanyWhereInput {
  const where: Prisma.LeadCompanyWhereInput = {};
  const and: Prisma.LeadCompanyWhereInput[] = [];

  if (filters.keyword?.trim()) {
    const keyword = filters.keyword.trim();
    and.push({
      OR: [
        { name: { contains: keyword, mode: 'insensitive' } },
        { domain: { contains: keyword, mode: 'insensitive' } },
        { sectorLabel: { contains: keyword, mode: 'insensitive' } },
      ],
    });
  }
  if (filters.sectorLabel?.trim()) and.push({ sectorLabel: { equals: filters.sectorLabel.trim(), mode: 'insensitive' } });
  if (filters.city?.trim()) and.push({ city: { contains: filters.city.trim(), mode: 'insensitive' } });
  if (filters.region?.trim()) and.push({ region: { contains: filters.region.trim(), mode: 'insensitive' } });
  if (filters.country?.trim()) and.push({ country: { contains: filters.country.trim(), mode: 'insensitive' } });
  if (filters.sizeRange?.trim()) and.push({ sizeRange: filters.sizeRange.trim() });
  if (filters.source?.trim() && filters.source.trim() in LeadSourceName) {
    and.push({ source: filters.source.trim() as LeadSourceName });
  }
  if (filters.hasLinkedin) and.push({ linkedinUrl: { not: null } });
  if (filters.hasEmail) and.push({ emails: { some: {} } });
  if (filters.hasPhone) and.push({ phones: { some: {} } });

  if (and.length) where.AND = and;
  return where;
}

export async function searchLeadCompanies(
  filters: LeadCompanyFilters,
  page = 1,
  pageSize = LEADGEN_PAGE_SIZE,
): Promise<{ companies: LeadCompanyListItem[]; total: number; page: number; pageSize: number }> {
  const size = clampPageSize(pageSize);
  const currentPage = Math.max(1, Math.floor(page) || 1);
  const where = buildCompanyWhere(filters);

  const [companies, total] = await Promise.all([
    prisma.leadCompany.findMany({
      where,
      select: COMPANY_LIST_SELECT,
      orderBy: { fetchedAt: 'desc' },
      skip: (currentPage - 1) * size,
      take: size,
    }),
    prisma.leadCompany.count({ where }),
  ]);

  return { companies, total, page: currentPage, pageSize: size };
}

export async function getLeadCompanyDetail(id: number) {
  return prisma.leadCompany.findUnique({
    where: { id },
    select: {
      ...COMPANY_LIST_SELECT,
      siren: true,
      siret: true,
      sourceDetail: true,
      persons: {
        select: {
          id: true,
          fullName: true,
          firstName: true,
          lastName: true,
          jobTitle: true,
          linkedinUrl: true,
          emails: { select: { id: true, email: true, validationStatus: true, confidenceScore: true } },
          phones: { select: { id: true, number: true, phoneType: true } },
        },
        take: 25,
      },
      emails: {
        where: { personId: null },
        select: { id: true, email: true, validationStatus: true, confidenceScore: true },
        take: 10,
      },
      phones: {
        where: { personId: null },
        select: { id: true, number: true, phoneType: true },
        take: 10,
      },
    },
  });
}

const PERSON_LIST_SELECT = {
  id: true,
  fullName: true,
  firstName: true,
  lastName: true,
  jobTitle: true,
  linkedinUrl: true,
  source: true,
  fetchedAt: true,
  company: {
    select: { id: true, name: true, domain: true, city: true, region: true, country: true, sectorLabel: true },
  },
  emails: { select: { id: true, email: true, validationStatus: true }, take: 1 },
  phones: { select: { id: true, number: true }, take: 1 },
} satisfies Prisma.LeadPersonSelect;

export type LeadPersonListItem = Prisma.LeadPersonGetPayload<{ select: typeof PERSON_LIST_SELECT }>;

function buildPersonWhere(filters: LeadPersonFilters): Prisma.LeadPersonWhereInput {
  const and: Prisma.LeadPersonWhereInput[] = [];

  if (filters.keyword?.trim()) {
    const keyword = filters.keyword.trim();
    and.push({
      OR: [
        { fullName: { contains: keyword, mode: 'insensitive' } },
        { jobTitle: { contains: keyword, mode: 'insensitive' } },
      ],
    });
  }
  if (filters.jobTitle?.trim()) and.push({ jobTitle: { contains: filters.jobTitle.trim(), mode: 'insensitive' } });
  if (filters.hasEmail) and.push({ emails: { some: {} } });

  const companyFilter: Prisma.LeadCompanyWhereInput = {};
  if (filters.companyName?.trim()) companyFilter.name = { contains: filters.companyName.trim(), mode: 'insensitive' };
  if (filters.city?.trim()) companyFilter.city = { contains: filters.city.trim(), mode: 'insensitive' };
  if (filters.region?.trim()) companyFilter.region = { contains: filters.region.trim(), mode: 'insensitive' };
  if (filters.country?.trim()) companyFilter.country = { contains: filters.country.trim(), mode: 'insensitive' };
  if (Object.keys(companyFilter).length) and.push({ company: companyFilter });

  return and.length ? { AND: and } : {};
}

export async function searchLeadPersons(
  filters: LeadPersonFilters,
  page = 1,
  pageSize = LEADGEN_PAGE_SIZE,
): Promise<{ persons: LeadPersonListItem[]; total: number; page: number; pageSize: number }> {
  const size = clampPageSize(pageSize);
  const currentPage = Math.max(1, Math.floor(page) || 1);
  const where = buildPersonWhere(filters);

  const [persons, total] = await Promise.all([
    prisma.leadPerson.findMany({
      where,
      select: PERSON_LIST_SELECT,
      orderBy: { fetchedAt: 'desc' },
      skip: (currentPage - 1) * size,
      take: size,
    }),
    prisma.leadPerson.count({ where }),
  ]);

  return { persons, total, page: currentPage, pageSize: size };
}

// ---------------------------------------------------------------------
// Facets (distinct filter option lists) — cached in-memory per server
// instance for a few minutes since these change rarely and are otherwise
// re-scanned on every page load of the filter bar.
// ---------------------------------------------------------------------
const FACET_TTL_MS = 10 * 60 * 1000;
let facetCache: { data: LeadCompanyFacets; expiresAt: number } | null = null;

export interface LeadCompanyFacets {
  sectors: string[];
  regions: string[];
  sizeRanges: string[];
  countries: string[];
}

export async function getLeadCompanyFacets(): Promise<LeadCompanyFacets> {
  if (facetCache && facetCache.expiresAt > Date.now()) {
    return facetCache.data;
  }

  const [sectors, regions, sizeRanges, countries] = await Promise.all([
    prisma.leadCompany.findMany({
      where: { sectorLabel: { not: null } },
      distinct: ['sectorLabel'],
      select: { sectorLabel: true },
      take: 200,
      orderBy: { sectorLabel: 'asc' },
    }),
    prisma.leadCompany.findMany({
      where: { region: { not: null } },
      distinct: ['region'],
      select: { region: true },
      take: 200,
      orderBy: { region: 'asc' },
    }),
    prisma.leadCompany.findMany({
      where: { sizeRange: { not: null } },
      distinct: ['sizeRange'],
      select: { sizeRange: true },
      take: 50,
      orderBy: { sizeRange: 'asc' },
    }),
    prisma.leadCompany.findMany({
      where: { country: { not: null } },
      distinct: ['country'],
      select: { country: true },
      take: 200,
      orderBy: { country: 'asc' },
    }),
  ]);

  const data: LeadCompanyFacets = {
    sectors: sectors.map((s) => s.sectorLabel!).filter(Boolean),
    regions: regions.map((r) => r.region!).filter(Boolean),
    sizeRanges: sizeRanges.map((s) => s.sizeRange!).filter(Boolean),
    countries: countries.map((c) => c.country!).filter(Boolean),
  };

  facetCache = { data, expiresAt: Date.now() + FACET_TTL_MS };
  return data;
}

/**
 * Best-effort analytics log — never throws, never blocks the response.
 */
export function logLeadSearchQuery(params: unknown, resultsCount: number, requesterIp?: string | null) {
  prisma.leadSearchQueryLog
    .create({
      data: {
        params: params as Prisma.InputJsonValue,
        resultsCount,
        requesterIp: requesterIp || null,
      },
    })
    .catch((err) => console.warn('[leadgen] Failed to log search query:', err));
}
