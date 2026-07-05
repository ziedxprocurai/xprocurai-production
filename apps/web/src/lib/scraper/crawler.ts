import * as cheerio from 'cheerio';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { verifyEmails, verifyPhones, type EmailVerificationResult, type PhoneVerificationResult } from './verifier';

/**
 * Same-domain website crawler that extracts & verifies contact info
 * (emails + phone numbers). Ported from the Python `ai_scrapper/crawler_service.py`
 * reference implementation, adapted for Next.js serverless (bounded by a wall-clock
 * time budget instead of relying on a long-lived process).
 */

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
};

const SKIP_EXTENSIONS = new Set([
  '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.zip', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
]);

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /(?<![\w.])(?:\+?\d[\d\s().-]{6,}\d)(?![\w.])/g;

function looksLikePhone(value: string, defaultRegion = 'FR'): boolean {
  const stripped = value.trim();
  const compact = stripped.replace(/\D/g, '');
  if (!compact || stripped.includes('.')) return false;
  if (compact.length < 7 || compact.length > 15) return false;
  if (/^17\d{8}$/.test(compact)) return false;
  try {
    const parsed = parsePhoneNumberFromString(stripped, defaultRegion as any);
    if (parsed && parsed.isValid()) return true;
  } catch {
    /* ignore */
  }
  if (stripped.startsWith('+') && !compact.startsWith('00')) return true;
  if (/[\s()]/.test(stripped) && compact.length >= 7 && compact.length <= 15) return true;
  if (/^\+?\d{7,15}$/.test(stripped)) return true;
  return false;
}

export interface CrawlOptions {
  targetUrl: string;
  maxPages: number;
  sameDomainOnly: boolean;
  delayMs: number;
  timeoutMs: number;
  verifyContacts: boolean;
  smtpVerify: boolean;
  phoneDefaultRegion: string;
  /** Hard wall-clock budget for the whole crawl (serverless function safety net). */
  budgetMs: number;
}

export interface CrawlPageResult {
  url: string;
  emails: string[];
  phones: string[];
}

export interface CrawlResult {
  targetUrl: string;
  pagesCrawled: number;
  pagesFailed: number;
  emailsFound: number;
  phonesFound: number;
  pages: CrawlPageResult[];
  verifiedEmails: (EmailVerificationResult & { pageUrl: string })[];
  verifiedPhones: (PhoneVerificationResult & { pageUrl: string })[];
  truncatedByBudget: boolean;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractContacts(rawHtml: string, phoneDefaultRegion: string): { emails: string[]; phones: string[] } {
  const emails = Array.from(new Set(rawHtml.match(EMAIL_RE) ?? [])).sort();
  const rawPhones = rawHtml.match(PHONE_RE) ?? [];
  const phones = Array.from(new Set(rawPhones.filter((p) => looksLikePhone(p, phoneDefaultRegion)))).sort();
  return { emails, phones };
}

function extractLinks($: cheerio.CheerioAPI, baseUrl: string, sameDomainOnly: boolean): Set<string> {
  const baseHost = new URL(baseUrl).host;
  const links = new Set<string>();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    try {
      const full = new URL(href, baseUrl);
      full.hash = '';
      if (!['http:', 'https:'].includes(full.protocol)) return;
      if (sameDomainOnly && full.host !== baseHost) return;
      const lowerPath = full.pathname.toLowerCase();
      if ([...SKIP_EXTENSIONS].some((ext) => lowerPath.endsWith(ext))) return;
      links.add(full.toString());
    } catch {
      /* ignore invalid URLs */
    }
  });

  return links;
}

async function fetchPage(url: string, timeoutMs: number): Promise<{ html: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: controller.signal, redirect: 'follow' });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? '';
    const text = await res.text();
    if (!contentType.includes('text/html') && !text.trim().startsWith('<')) return null;
    return { html: text };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function runCrawl(options: CrawlOptions): Promise<CrawlResult> {
  const startedAt = Date.now();
  const visited = new Set<string>();
  const toVisit: string[] = [options.targetUrl];
  const pages: CrawlPageResult[] = [];

  let pagesCrawled = 0;
  let pagesFailed = 0;
  let truncatedByBudget = false;

  const allEmails = new Map<string, { email: string; pageUrl: string }>();
  const allPhones = new Map<string, { phone: string; pageUrl: string }>();

  while (toVisit.length > 0 && pagesCrawled < options.maxPages) {
    if (Date.now() - startedAt > options.budgetMs) {
      truncatedByBudget = true;
      break;
    }

    const rawUrl = toVisit.shift()!;
    let url: string;
    try {
      const u = new URL(rawUrl);
      u.hash = '';
      url = u.toString();
    } catch {
      continue;
    }
    if (visited.has(url)) continue;
    visited.add(url);
    pagesCrawled += 1;

    const fetched = await fetchPage(url, options.timeoutMs);
    if (!fetched) {
      pagesFailed += 1;
      continue;
    }

    const $ = cheerio.load(fetched.html);
    const { emails, phones } = extractContacts(fetched.html, options.phoneDefaultRegion);
    const childLinks = extractLinks($, url, options.sameDomainOnly);

    for (const link of childLinks) {
      if (!visited.has(link) && !toVisit.includes(link)) toVisit.push(link);
    }

    for (const email of emails) {
      if (!allEmails.has(email)) allEmails.set(email, { email, pageUrl: url });
    }
    for (const phone of phones) {
      if (!allPhones.has(phone)) allPhones.set(phone, { phone, pageUrl: url });
    }

    pages.push({ url, emails, phones });

    if (options.delayMs > 0 && toVisit.length > 0) {
      await sleep(options.delayMs);
    }
  }

  let verifiedEmails: (EmailVerificationResult & { pageUrl: string })[] = [];
  let verifiedPhones: (PhoneVerificationResult & { pageUrl: string })[] = [];

  if (options.verifyContacts) {
    const emailEntries = Array.from(allEmails.values());
    const phoneEntries = Array.from(allPhones.values());

    const emailResults = await verifyEmails(
      emailEntries.map((e) => e.email),
      options.smtpVerify,
      options.smtpVerify,
    );
    verifiedEmails = emailResults.map((result, i) => ({ ...result, pageUrl: emailEntries[i]!.pageUrl }));

    const phoneResults = verifyPhones(
      phoneEntries.map((p) => p.phone),
      options.phoneDefaultRegion,
    );
    verifiedPhones = phoneResults.map((result, i) => ({ ...result, pageUrl: phoneEntries[i]!.pageUrl }));
  } else {
    verifiedEmails = Array.from(allEmails.values()).map(({ email, pageUrl }) => ({
      email,
      syntaxValid: true,
      isDisposableOrFakePattern: false,
      hasMxRecord: null,
      mxHost: null,
      smtpStatus: 'skipped',
      smtpDetail: '',
      credibility: 'low',
      score: 0,
      deliverability: 'uncertain',
      risk: 'medium',
      reason: 'Verification disabled',
      checks: {},
      pageUrl,
    }));
    verifiedPhones = Array.from(allPhones.values()).map(({ phone, pageUrl }) => ({
      raw: phone,
      parsedE164: null,
      isValid: false,
      isPossible: false,
      numberType: 'unknown',
      region: null,
      carrier: null,
      credibility: 'low',
      pageUrl,
    }));
  }

  return {
    targetUrl: options.targetUrl,
    pagesCrawled,
    pagesFailed,
    emailsFound: allEmails.size,
    phonesFound: allPhones.size,
    pages,
    verifiedEmails,
    verifiedPhones,
    truncatedByBudget,
  };
}

export function normalizeTargetUrl(input: string): string {
  const trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

export function inferPhoneRegion(targetUrl: string): string {
  return targetUrl.toLowerCase().includes('.tn') ? 'TN' : 'FR';
}
