import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { runCrawl, normalizeTargetUrl, inferPhoneRegion } from '@/lib/scraper/crawler';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_PAGES_LIMIT = 15;
// Leave headroom below the serverless function timeout so we always return a response.
const CRAWL_BUDGET_MS = 45000;

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ message: 'Admin access required' }, { status: 403 });
  }

  try {
    const jobs = await prisma.scraperJob.findMany({
      include: { _count: { select: { contacts: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json(jobs);
  } catch (err) {
    console.error('[api/admin/scraper/jobs GET]', err);
    return NextResponse.json({ message: 'Failed to fetch scraper jobs' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ message: 'Admin access required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const rawUrl = (body.targetUrl || body.url || '').trim();
    if (!rawUrl) {
      return NextResponse.json({ message: 'targetUrl is required' }, { status: 400 });
    }

    const targetUrl = normalizeTargetUrl(rawUrl);
    const maxPages = Math.min(Math.max(1, parseInt(body.maxPages, 10) || 5), MAX_PAGES_LIMIT);
    const verifyContacts = body.verifyContacts !== false;
    const smtpVerify = body.smtpVerify === true;
    const sameDomainOnly = body.sameDomainOnly !== false;
    const companyName = body.companyName ? String(body.companyName).slice(0, 200) : null;

    let targetHost: string;
    try {
      targetHost = new URL(targetUrl).host;
    } catch {
      return NextResponse.json({ message: 'Invalid target URL' }, { status: 400 });
    }

    const job = await prisma.scraperJob.create({
      data: {
        targetUrl,
        companyName,
        maxPages,
        verifyContacts,
        smtpVerify,
        status: 'RUNNING',
        createdById: admin.id,
      },
    });

    try {
      const result = await runCrawl({
        targetUrl,
        maxPages,
        sameDomainOnly,
        delayMs: 300,
        timeoutMs: 8000,
        verifyContacts,
        smtpVerify,
        phoneDefaultRegion: inferPhoneRegion(targetUrl),
        budgetMs: CRAWL_BUDGET_MS,
      });

      const contactCreates = [
        ...result.verifiedEmails.map((e) =>
          prisma.scrapedContact.create({
            data: {
              jobId: job.id,
              type: 'EMAIL',
              value: e.email,
              pageUrl: e.pageUrl,
              credibility: e.credibility,
              score: e.score,
              deliverability: e.deliverability,
              details: e as any,
            },
          }),
        ),
        ...result.verifiedPhones.map((p) =>
          prisma.scrapedContact.create({
            data: {
              jobId: job.id,
              type: 'PHONE',
              value: p.parsedE164 || p.raw,
              pageUrl: p.pageUrl,
              credibility: p.credibility,
              score: p.credibility === 'high' ? 90 : p.credibility === 'low' ? 40 : 0,
              deliverability: null,
              details: p as any,
            },
          }),
        ),
      ];

      await Promise.all(contactCreates);

      const updatedJob = await prisma.scraperJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          pagesCrawled: result.pagesCrawled,
          pagesFailed: result.pagesFailed,
          emailsFound: result.emailsFound,
          phonesFound: result.phonesFound,
          errorMessage: result.truncatedByBudget
            ? 'Crawl stopped early to stay within the platform time budget. Results may be partial.'
            : null,
        },
        include: {
          contacts: { orderBy: [{ score: 'desc' }, { createdAt: 'asc' }] },
          _count: { select: { contacts: true } },
        },
      });

      return NextResponse.json(updatedJob);
    } catch (crawlErr: any) {
      const failedJob = await prisma.scraperJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', errorMessage: crawlErr.message || 'Crawl failed' },
      });
      return NextResponse.json(
        { message: crawlErr.message || 'Crawl failed', job: failedJob },
        { status: 500 },
      );
    }
  } catch (err: any) {
    console.error('[api/admin/scraper/jobs POST]', err);
    return NextResponse.json({ message: err.message || 'Failed to start scrape job' }, { status: 500 });
  }
}
