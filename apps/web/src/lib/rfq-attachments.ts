import type { RfqRequestPayload } from './rfq-payload';

interface SignedAttachmentUpload {
  path: string;
  signedUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string | null;
}

/** Upload directly to storage, keeping file bytes out of the Next.js API. */
export async function uploadRfqAttachments(
  files: File[],
  batchId: string,
): Promise<RfqRequestPayload['attachments']> {
  if (files.length === 0) return [];
  const response = await fetch('/api/rfqs/attachments/upload-urls', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      batchId,
      files: files.map((file) => ({ name: file.name, size: file.size, type: file.type })),
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || 'Failed to prepare attachment uploads');
  const uploads: SignedAttachmentUpload[] = data.uploads;
  if (!Array.isArray(uploads) || uploads.length !== files.length) {
    throw new Error('Attachment upload mapping failed');
  }

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const upload = uploads[index];
    if (!upload?.signedUrl || !upload.path || upload.fileSize !== file.size) {
      throw new Error('Attachment upload mapping failed');
    }
    // Matches Supabase uploadToSignedUrl() for File bodies.
    const formData = new FormData();
    formData.append('cacheControl', '3600');
    formData.append('', file);
    const result = await fetch(upload.signedUrl, {
      method: 'PUT',
      headers: { 'x-upsert': 'false' },
      body: formData,
    });
    if (!result.ok) throw new Error(`Failed to upload attachment: ${file.name}`);
  }

  return uploads.map(({ path, fileName, fileSize, mimeType }) => ({
    path, fileName, fileSize, mimeType,
  }));
}