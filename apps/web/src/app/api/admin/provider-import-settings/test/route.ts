import { NextResponse } from 'next/server';
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

    if (!setting?.value) {
      return NextResponse.json({ success: false, message: 'No API key configured.' });
    }

    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(setting.value);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    await model.generateContent('Reply with the word OK only.');

    return NextResponse.json({ success: true, message: 'Gemini API key is valid and working.' });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      message: err.message || 'Gemini API key validation failed.',
    });
  }
}
