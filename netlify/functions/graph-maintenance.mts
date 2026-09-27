// Netlify scheduled function: keeps the Microsoft Graph Inbox subscription
// alive and sweeps for replies the webhook may have missed.
// Runs every 30 minutes; calls the internal maintenance endpoint with the
// shared CRON_SECRET. No imports — plain fetch only.

export default async () => {
  const baseUrl = (process.env.URL || process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');
  const cronSecret = (process.env.CRON_SECRET || '').trim();
  if (!baseUrl || !cronSecret) {
    console.log(
      `[graph-maintenance] skipping — missing: ${[!baseUrl && 'URL/NEXT_PUBLIC_APP_URL', !cronSecret && 'CRON_SECRET']
        .filter(Boolean)
        .join(', ')}`,
    );
    return new Response('ok');
  }

  try {
    const res = await fetch(`${baseUrl}/api/internal/graph/maintenance`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    const body = await res.text().catch(() => '');
    console.log(`[graph-maintenance] status ${res.status} ${body.slice(0, 500)}`);
  } catch (err) {
    console.error('[graph-maintenance] request failed:', err);
  }
  return new Response('ok');
};

export const config = { schedule: '*/30 * * * *' };
