// Netlify scheduled function: keeps the Microsoft Graph Inbox subscription
// alive and sweeps for replies the webhook may have missed.
// Runs every 30 minutes; calls the internal maintenance endpoint with the
// shared CRON_SECRET. No imports — plain fetch only.

export default async () => {
  const baseUrl = process.env.URL;
  const cronSecret = process.env.CRON_SECRET;
  if (!baseUrl || !cronSecret) {
    console.log('[graph-maintenance] URL or CRON_SECRET not configured — skipping');
    return new Response('ok');
  }

  try {
    const res = await fetch(`${baseUrl}/api/internal/graph/maintenance`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    console.log(`[graph-maintenance] status ${res.status}`);
  } catch (err) {
    console.error('[graph-maintenance] request failed:', err);
  }
  return new Response('ok');
};

export const config = { schedule: '*/30 * * * *' };
