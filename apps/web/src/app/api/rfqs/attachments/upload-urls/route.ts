import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import {
  createAttachmentUploadUrl,
  SUPABASE_STORAGE_NOT_CONFIGURED_MESSAGE,
} from '@/lib/supabase-storage';
import {
  ALLOWED_RFQ_ATTACHMENT_EXTENSIONS,
  MAX_RFQ_ATTACHMENT_BYTES,
  MAX_RFQ_ATTACHMENTS,
  formatFileSize,
  getFileExtension,
  sanitizeFileName,
} from '@/lib/rfq-constants';

export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_EXTENSIONS = new Set<string>(ALLOWED_RFQ_ATTACHMENT_EXTENSIONS);

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  if (!user.company) {
    return NextResponse.json(
      { message: 'User must belong to a company to upload attachments' },
      { status: 403 },
    );
  }

  try {
    const body = await req.json();
    const { batchId, files } = body ?? {};

    if (typeof batchId !== 'string' || !UUID_RE.test(batchId)) {
      return NextResponse.json(
        { message: 'A valid batchId (UUID) is required' },
        { status: 400 },
      );
    }

    if (!Array.isArray(files) || files.length === 0 || files.length > MAX_RFQ_ATTACHMENTS) {
      return NextResponse.json(
        { message: `Provide between 1 and ${MAX_RFQ_ATTACHMENTS} files` },
        { status: 400 },
      );
    }

    for (const file of files) {
      const name = typeof file?.name === 'string' ? file.name : '';
      const extension = getFileExtension(name);
      if (!name || !extension || !ALLOWED_EXTENSIONS.has(extension)) {
        return NextResponse.json(
          { message: `File type not allowed: ${name || 'unnamed file'}` },
          { status: 400 },
        );
      }
      const size = Number(file?.size);
      if (!Number.isInteger(size) || size <= 0) {
        return NextResponse.json(
          { message: `Invalid file size for: ${name}` },
          { status: 400 },
        );
      }
      if (size > MAX_RFQ_ATTACHMENT_BYTES) {
        return NextResponse.json(
          {
            message: `File exceeds the ${formatFileSize(MAX_RFQ_ATTACHMENT_BYTES)} limit: ${name}`,
          },
          { status: 400 },
        );
      }
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { message: SUPABASE_STORAGE_NOT_CONFIGURED_MESSAGE },
        { status: 503 },
      );
    }

    const uploads = [];
    for (const file of files as { name: string; size: number; type?: string }[]) {
      const safeName = sanitizeFileName(file.name);
      const path = `${user.company.id}/${batchId}/${crypto.randomUUID()}-${safeName}`;
      const { signedUrl, token } = await createAttachmentUploadUrl(path);
      uploads.push({
        path,
        signedUrl,
        token,
        fileName: file.name.trim().slice(0, 255),
        fileSize: file.size,
        mimeType: typeof file.type === 'string' && file.type ? file.type : null,
      });
    }

    return NextResponse.json({ uploads });
  } catch (err) {
    console.error('[api/rfqs/attachments/upload-urls] Error:', err);
    return NextResponse.json(
      { message: 'Failed to create upload URLs' },
      { status: 500 },
    );
  }
}
