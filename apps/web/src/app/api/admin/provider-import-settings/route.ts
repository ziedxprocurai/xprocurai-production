import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ message: 'Admin access required' }, { status: 403 });
  }

  try {
    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'PROVIDER_IMPORT_AI_API_KEY' },
    });

    return NextResponse.json({
      hasApiKey: !!setting?.value,
      keyPreview: setting?.value
        ? `${setting.value.slice(0, 8)}${'*'.repeat(20)}`
        : null,
      updatedAt: setting?.updatedAt ?? null,
    });
  } catch (err) {
    console.error('[api/admin/provider-import-settings GET]', err);
    return NextResponse.json({ message: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ message: 'Admin access required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { value } = body;

    if (!value || typeof value !== 'string') {
      return NextResponse.json({ message: 'API key value is required' }, { status: 400 });
    }

    const setting = await prisma.adminSetting.upsert({
      where: { key: 'PROVIDER_IMPORT_AI_API_KEY' },
      update: { value },
      create: { key: 'PROVIDER_IMPORT_AI_API_KEY', value },
    });

    return NextResponse.json({
      hasApiKey: true,
      keyPreview: `${setting.value.slice(0, 8)}${'*'.repeat(20)}`,
      updatedAt: setting.updatedAt,
      message: 'API key saved successfully.',
    });
  } catch (err) {
    console.error('[api/admin/provider-import-settings PUT]', err);
    return NextResponse.json({ message: 'Failed to update settings' }, { status: 500 });
  }
}
