import dns from 'node:dns/promises';
import net from 'node:net';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * Email & phone credibility verification for scraped business contact data.
 * Ported from the Python `ai_scrapper/verifier.py` reference implementation.
 *
 * Email verification (cheapest first, stops early on a clear fail):
 *   1. Syntax check (regex)
 *   2. Disposable/fake-pattern check (test@, example.com, noreply@, etc.)
 *   3. MX record lookup (does the domain even accept mail?)
 *   4. SPF/DMARC presence
 *   5. (optional) SMTP RCPT TO probe — best-effort only. Many mail providers
 *      block or greylist probing connections, and outbound port 25 is often
 *      blocked on serverless platforms, so "unknown" is a legitimate outcome.
 */

const SMTP_TIMEOUT_MS = 5000;
const SMTP_FROM_ADDRESS = 'verify@example.com';
const SMTP_HELO_DOMAIN = 'example.com';

const DISPOSABLE_OR_FAKE_PATTERNS = [
  /^test@/i, /^example@/i, /^demo@/i, /^sample@/i, /^noreply@/i, /^no-reply@/i,
  /^donotreply@/i, /^admin@example\./i, /^user@/i, /^foo@/i, /^bar@/i,
  /@example\.(com|org|net)$/i, /@test\.(com|local)$/i, /@domain\.(com|tld)$/i,
  /@yourcompany\./i, /@yourdomain\./i, /@company\.com$/i,
];

const EMAIL_REGEX = /^[\w.\-+]+@[\w.-]+\.\w+$/;

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.fr', 'outlook.com', 'live.com', 'hotmail.com',
  'icloud.com', 'me.com', 'proton.me', 'protonmail.com', 'aol.com', 'yandex.com', 'gmx.com',
  'mail.com', 'zoho.com', 'tuta.io', 'tutanota.com',
]);

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'yopmail.com', 'tempmail.com', '10minutemail.com', 'guerrillamail.com',
  'throwaway.email', 'fakeinbox.com', 'trashmail.com', 'maildrop.cc', 'getnada.com',
  'temp-mail.org', 'sharklasers.com', 'disposable.com',
]);

const ROLE_BASED_LOCAL_PARTS = new Set([
  'admin', 'administration', 'contact', 'info', 'support', 'sales', 'vente', 'secretariat',
  'secretaire', 'direction', 'dg', 'rh', 'hr', 'compta', 'finance', 'accueil', 'standard',
  'noreply', 'no-reply', 'donotreply',
]);

const mxCache = new Map<string, { hasMx: boolean; mxHost: string | null }>();
const txtCache = new Map<string, string[]>();

export interface EmailVerificationResult {
  email: string;
  syntaxValid: boolean;
  isDisposableOrFakePattern: boolean;
  hasMxRecord: boolean | null;
  mxHost: string | null;
  smtpStatus: 'valid' | 'invalid' | 'unknown' | 'skipped';
  smtpDetail: string;
  credibility: 'high' | 'medium' | 'low' | 'rejected';
  score: number;
  deliverability: 'confirmed' | 'likely' | 'uncertain' | 'risky' | 'invalid';
  risk: 'low' | 'medium' | 'high';
  reason: string;
  checks: Record<string, unknown>;
}

export interface PhoneVerificationResult {
  raw: string;
  parsedE164: string | null;
  isValid: boolean;
  isPossible: boolean;
  numberType: string;
  region: string | null;
  carrier: string | null;
  credibility: 'high' | 'low' | 'rejected';
}

function emailDomain(email: string): string {
  return email.split('@').pop()!.toLowerCase();
}

function looksFake(email: string): boolean {
  const lower = email.toLowerCase();
  const domain = emailDomain(email);
  return DISPOSABLE_OR_FAKE_PATTERNS.some((p) => p.test(lower)) || DISPOSABLE_DOMAINS.has(domain);
}

function isFreeProvider(domain: string): boolean {
  return FREE_EMAIL_DOMAINS.has(domain);
}

function isRoleBased(email: string): boolean {
  const localPart = email.split('@')[0]!.toLowerCase();
  const normalized = localPart.replace(/[^a-z0-9]/g, '');
  return ROLE_BASED_LOCAL_PARTS.has(normalized);
}

async function getTxtRecords(domain: string): Promise<string[]> {
  if (txtCache.has(domain)) return txtCache.get(domain)!;
  try {
    const records = await dns.resolveTxt(domain);
    const flat = records.map((chunks) => chunks.join(''));
    txtCache.set(domain, flat);
    return flat;
  } catch {
    txtCache.set(domain, []);
    return [];
  }
}

async function hasSpf(domain: string): Promise<boolean> {
  const records = await getTxtRecords(domain);
  return records.some((r) => r.startsWith('v=spf1'));
}

async function hasDmarc(domain: string): Promise<boolean> {
  try {
    const records = await dns.resolveTxt(`_dmarc.${domain}`);
    return records.some((chunks) => chunks.join('').toLowerCase().startsWith('v=dmarc1'));
  } catch {
    return false;
  }
}

async function getMxHost(domain: string): Promise<{ hasMx: boolean; mxHost: string | null }> {
  if (mxCache.has(domain)) return mxCache.get(domain)!;
  try {
    const records = await dns.resolveMx(domain);
    if (records.length === 0) throw new Error('no mx');
    records.sort((a, b) => a.priority - b.priority);
    const result = { hasMx: true, mxHost: records[0]!.exchange };
    mxCache.set(domain, result);
    return result;
  } catch {
    const result = { hasMx: false, mxHost: null };
    mxCache.set(domain, result);
    return result;
  }
}

/**
 * Best-effort SMTP RCPT TO probe. Many networks (including serverless
 * platforms) block outbound port 25 — a timeout/refusal is treated as
 * "unknown", never coerced to true/false.
 */
function smtpProbe(email: string, mxHost: string): Promise<{ smtpStatus: 'valid' | 'invalid' | 'unknown'; smtpDetail: string }> {
  return new Promise((resolve) => {
    let settled = false;
    let stage = 0; // 0=connect,1=helo,2=mail,3=rcpt
    const socket = net.createConnection({ host: mxHost, port: 25, timeout: SMTP_TIMEOUT_MS });

    const finish = (result: { smtpStatus: 'valid' | 'invalid' | 'unknown'; smtpDetail: string }) => {
      if (settled) return;
      settled = true;
      try {
        socket.write('QUIT\r\n');
      } catch {
        /* ignore */
      }
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(SMTP_TIMEOUT_MS, () => {
      finish({ smtpStatus: 'unknown', smtpDetail: 'connection timed out' });
    });

    socket.on('error', (err) => {
      finish({ smtpStatus: 'unknown', smtpDetail: `server blocked probe or unreachable: ${err.message}` });
    });

    socket.on('data', (data) => {
      const line = data.toString();
      const code = parseInt(line.slice(0, 3), 10);

      if (stage === 0 && code === 220) {
        stage = 1;
        socket.write(`HELO ${SMTP_HELO_DOMAIN}\r\n`);
      } else if (stage === 1 && code === 250) {
        stage = 2;
        socket.write(`MAIL FROM:<${SMTP_FROM_ADDRESS}>\r\n`);
      } else if (stage === 2 && code === 250) {
        stage = 3;
        socket.write(`RCPT TO:<${email}>\r\n`);
      } else if (stage === 3) {
        if (code === 250) {
          finish({ smtpStatus: 'valid', smtpDetail: 'mailbox accepted' });
        } else if (code === 550 || code === 551 || code === 553) {
          finish({ smtpStatus: 'invalid', smtpDetail: `rejected (code ${code})` });
        } else {
          finish({ smtpStatus: 'unknown', smtpDetail: `ambiguous response (code ${code})` });
        }
      } else if (code >= 400) {
        finish({ smtpStatus: 'unknown', smtpDetail: `ambiguous response (code ${code})` });
      }
    });
  });
}

function scoreEmail(checks: Record<string, any>): { score: number; deliverability: EmailVerificationResult['deliverability']; risk: EmailVerificationResult['risk']; reason: string } {
  if (checks.disposableOrFake) return { score: 0, deliverability: 'invalid', risk: 'high', reason: 'disposable or fake-pattern domain' };
  if (!checks.syntaxValid) return { score: 0, deliverability: 'invalid', risk: 'high', reason: 'invalid email syntax' };
  if (!checks.mxRecord) return { score: 20, deliverability: 'invalid', risk: 'high', reason: 'domain has no MX record' };

  let score = 40;
  if (checks.spf === 'present') score += 8;
  else if (checks.spf === 'missing') score -= 5;
  if (checks.dmarc === 'present') score += 7;
  else if (checks.dmarc === 'missing') score -= 3;
  if (checks.freeProvider) score -= 5;
  if (checks.roleBased) score -= 3;

  let deliverability: EmailVerificationResult['deliverability'];
  let reason: string;

  if (checks.smtpStatus === 'valid') {
    score += 35;
    if (checks.catchAll) {
      score -= 10;
      deliverability = 'risky';
      reason = 'SMTP accepted, but domain appears catch-all';
    } else {
      deliverability = 'confirmed';
      reason = 'SMTP accepted the mailbox';
    }
  } else if (checks.smtpStatus === 'invalid') {
    return { score: 0, deliverability: 'invalid', risk: 'high', reason: 'SMTP rejected the mailbox' };
  } else if (checks.smtpStatus === 'unknown') {
    score += 18;
    deliverability = 'uncertain';
    reason = 'SMTP probe was inconclusive';
  } else {
    deliverability = checks.spf === 'present' && checks.dmarc === 'present' ? 'likely' : 'uncertain';
    reason = 'Syntax + MX verified; SMTP not run';
  }

  score = Math.max(0, Math.min(100, score));
  const risk: EmailVerificationResult['risk'] = score >= 80 ? 'low' : score >= 55 ? 'medium' : 'high';
  return { score, deliverability, risk, reason };
}

export function credibilityFromScore(score: number): EmailVerificationResult['credibility'] {
  if (score >= 80) return 'high';
  if (score >= 65) return 'medium';
  if (score >= 40) return 'low';
  return 'rejected';
}

export async function verifyEmail(rawEmail: string, doSmtp = true, checkCatchAll = true): Promise<EmailVerificationResult> {
  const email = rawEmail.trim();
  const out: EmailVerificationResult = {
    email,
    syntaxValid: false,
    isDisposableOrFakePattern: false,
    hasMxRecord: null,
    mxHost: null,
    smtpStatus: 'skipped',
    smtpDetail: '',
    credibility: 'rejected',
    score: 0,
    deliverability: 'uncertain',
    risk: 'high',
    reason: '',
    checks: {},
  };

  out.syntaxValid = EMAIL_REGEX.test(email);
  if (!out.syntaxValid) {
    out.credibility = 'rejected';
    out.reason = 'invalid email syntax';
    return out;
  }

  out.isDisposableOrFakePattern = looksFake(email);
  if (out.isDisposableOrFakePattern) {
    out.credibility = 'rejected';
    out.reason = 'disposable or fake-pattern domain';
    return out;
  }

  const domain = emailDomain(email);
  const { hasMx, mxHost } = await getMxHost(domain);
  const spfPresent = hasMx ? await hasSpf(domain) : false;
  const dmarcPresent = hasMx ? await hasDmarc(domain) : false;
  const freeProvider = isFreeProvider(domain);
  const roleBased = isRoleBased(email);

  out.hasMxRecord = hasMx;
  out.mxHost = mxHost;

  const checks: Record<string, any> = {
    syntaxValid: out.syntaxValid,
    disposableOrFake: out.isDisposableOrFakePattern,
    freeProvider,
    roleBased,
    mxRecord: hasMx,
    mxHost,
    spf: hasMx ? (spfPresent ? 'present' : 'missing') : 'unchecked',
    dmarc: hasMx ? (dmarcPresent ? 'present' : 'missing') : 'unchecked',
    smtpStatus: 'skipped',
    smtpDetail: '',
    catchAll: null,
  };

  if (!hasMx) {
    const { score, deliverability, risk, reason } = scoreEmail(checks);
    Object.assign(out, { credibility: 'low', score, deliverability, risk, reason, checks });
    return out;
  }

  if (doSmtp && mxHost) {
    const smtpResult = await smtpProbe(email, mxHost);
    checks.smtpStatus = smtpResult.smtpStatus;
    checks.smtpDetail = smtpResult.smtpDetail;
    out.smtpStatus = smtpResult.smtpStatus;
    out.smtpDetail = smtpResult.smtpDetail;

    if (smtpResult.smtpStatus === 'valid' && checkCatchAll) {
      const randomLocal = `probe_${Math.random().toString(36).slice(2, 10)}`;
      const catchAllResult = await smtpProbe(`${randomLocal}@${domain}`, mxHost);
      checks.catchAll = catchAllResult.smtpStatus === 'valid';
    }
  }

  const { score, deliverability, risk, reason } = scoreEmail(checks);
  Object.assign(out, { credibility: credibilityFromScore(score), score, deliverability, risk, reason, checks });
  return out;
}

export async function verifyEmails(emails: string[], doSmtp = true, checkCatchAll = true): Promise<EmailVerificationResult[]> {
  const results: EmailVerificationResult[] = [];
  for (const email of emails) {
    results.push(await verifyEmail(email, doSmtp, checkCatchAll));
  }
  return results;
}

export function verifyPhone(rawNumber: string, defaultRegion: string = 'FR'): PhoneVerificationResult {
  const out: PhoneVerificationResult = {
    raw: rawNumber,
    parsedE164: null,
    isValid: false,
    isPossible: false,
    numberType: 'unknown',
    region: null,
    carrier: null,
    credibility: 'rejected',
  };

  try {
    const phone = parsePhoneNumberFromString(rawNumber, defaultRegion as any);
    if (!phone) return out;

    out.isPossible = phone.isPossible();
    out.isValid = phone.isValid();

    if (!out.isValid) {
      out.credibility = out.isPossible ? 'low' : 'rejected';
      return out;
    }

    out.parsedE164 = phone.formatInternational().replace(/\s+/g, '');
    out.numberType = phone.getType() || 'unknown';
    out.region = phone.country || null;
    out.credibility = 'high';
    return out;
  } catch {
    return out;
  }
}

export function verifyPhones(phones: string[], defaultRegion = 'FR'): PhoneVerificationResult[] {
  return phones.map((p) => verifyPhone(p, defaultRegion));
}
