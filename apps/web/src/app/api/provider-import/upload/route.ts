import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const ALLOWED_EXTENSIONS = ['.csv', '.xls', '.xlsx'];
const MAX_ROWS_FOR_AI = 100;

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  if (!user.company) {
    return NextResponse.json(
      { message: 'User must belong to a company to import providers.' },
      { status: 403 },
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ message: 'No file provided' }, { status: 400 });
    }

    const fileName = file.name;
    const fileExt = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
      return NextResponse.json(
        { message: 'Invalid file type. Only CSV, XLS, and XLSX files are allowed.' },
        { status: 400 },
      );
    }

    // Parse file
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({ message: 'No sheets found in the file.' }, { status: 400 });
    }
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: null });

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { message: 'The file appears to be empty or could not be parsed.' },
        { status: 400 },
      );
    }

    // Create document record
    const document = await prisma.providerImportDocument.create({
      data: {
        fileName,
        fileSize: file.size,
        fileType: fileExt.slice(1).toUpperCase(),
        status: 'PROCESSING',
        companyId: user.company.id,
      },
    });

    // Get AI API key
    const apiKeySetting = await prisma.adminSetting.findUnique({
      where: { key: 'PROVIDER_IMPORT_AI_API_KEY' },
    });

    if (!apiKeySetting?.value) {
      await prisma.providerImportDocument.update({
        where: { id: document.id },
        data: { status: 'FAILED', errorMessage: 'AI API key is not configured.' },
      });
      return NextResponse.json(
        { message: 'AI API key is not configured. Please ask your platform administrator to set it up.' },
        { status: 500 },
      );
    }

    // Extract with AI
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKeySetting.value);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const dataToProcess = rows.slice(0, MAX_ROWS_FOR_AI);
      const dataStr = JSON.stringify(dataToProcess, null, 2);

      const prompt = `You are a data extraction assistant for a B2B procurement platform. Extract provider/supplier company information from the provided structured data.

Return ONLY a JSON object with a single key "providers" containing an array of extracted provider objects. Each provider object must have exactly these fields (use null for missing/unknown values):
- companyName: string or null
- contactPerson: string or null
- email: string or null
- phone: string or null
- address: string or null
- country: string or null
- vatId: string or null (VAT number, tax ID, EIN, etc.)
- website: string or null
- notes: string or null (any other relevant business information)

Rules:
- Each row or record in the input represents one provider/supplier
- Map input column names intelligently (e.g., "Company" → companyName, "Contact" → contactPerson)
- Extract ALL rows, even if some fields are missing
- Do not invent or guess data that is not present
- Return only valid JSON with no markdown, no code blocks

Data to extract:
${dataStr}`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      if (!responseText) {
        throw new Error('No response received from Gemini AI service.');
      }

      let parsed: any;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        throw new Error('AI returned invalid JSON response.');
      }

      const providers: any[] = Array.isArray(parsed.providers)
        ? parsed.providers
        : Array.isArray(parsed)
          ? parsed
          : [];

      if (providers.length === 0) {
        throw new Error('AI could not extract any provider records from the file.');
      }

      // Create records
      const createOps = providers.map((provider) =>
        prisma.providerImportRecord.create({
          data: {
            documentId: document.id,
            companyId: user.company!.id,
            companyName: provider.companyName ?? null,
            contactPerson: provider.contactPerson ?? null,
            email: provider.email ?? null,
            phone: provider.phone ?? null,
            address: provider.address ?? null,
            country: provider.country ?? null,
            vatId: provider.vatId ?? null,
            website: provider.website ?? null,
            notes: provider.notes ?? null,
            rawData: provider,
            status: 'PENDING',
            isSelected: true,
          },
        }),
      );

      await Promise.all(createOps);

      await prisma.providerImportDocument.update({
        where: { id: document.id },
        data: { status: 'EXTRACTED' },
      });

      const result2 = await prisma.providerImportDocument.findUnique({
        where: { id: document.id },
        include: {
          records: { orderBy: { createdAt: 'asc' } },
          _count: { select: { records: true } },
        },
      });

      return NextResponse.json(result2);
    } catch (aiErr: any) {
      await prisma.providerImportDocument.update({
        where: { id: document.id },
        data: { status: 'FAILED', errorMessage: aiErr.message || 'AI extraction failed' },
      });
      return NextResponse.json(
        { message: aiErr.message || 'AI extraction failed. Please check your AI API key settings.' },
        { status: 500 },
      );
    }
  } catch (err: any) {
    console.error('[api/provider-import/upload]', err);
    return NextResponse.json(
      { message: err.message || 'Upload failed' },
      { status: 500 },
    );
  }
}
