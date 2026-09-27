// Server-only: never import this module from client components.
// It holds the Supabase service-role key, which must stay off the browser.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const RFQ_ATTACHMENTS_BUCKET =
  process.env.SUPABASE_RFQ_ATTACHMENTS_BUCKET || 'rfq-attachments';

export const SUPABASE_STORAGE_NOT_CONFIGURED_MESSAGE =
  'Supabase Storage is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)';

let client: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(SUPABASE_STORAGE_NOT_CONFIGURED_MESSAGE);
  }
  if (!client) {
    client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export async function createAttachmentUploadUrl(path: string) {
  const { data, error } = await getSupabaseClient()
    .storage.from(RFQ_ATTACHMENTS_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    throw new Error(error?.message || 'Failed to create signed upload URL');
  }
  return { signedUrl: data.signedUrl, token: data.token, path: data.path };
}

export async function createAttachmentDownloadUrl(
  path: string,
  fileName?: string,
  expiresInSeconds = 300,
) {
  const { data, error } = await getSupabaseClient()
    .storage.from(RFQ_ATTACHMENTS_BUCKET)
    .createSignedUrl(path, expiresInSeconds, fileName ? { download: fileName } : undefined);
  if (error || !data) {
    throw new Error(error?.message || 'Failed to create signed download URL');
  }
  return data.signedUrl;
}

export async function downloadAttachment(path: string): Promise<Buffer> {
  const { data, error } = await getSupabaseClient()
    .storage.from(RFQ_ATTACHMENTS_BUCKET)
    .download(path);
  if (error || !data) {
    throw new Error(error?.message || 'Failed to download attachment');
  }
  return Buffer.from(await data.arrayBuffer());
}
