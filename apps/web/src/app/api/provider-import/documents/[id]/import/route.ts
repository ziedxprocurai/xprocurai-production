import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  if (!user.company) {
    return NextResponse.json({ message: 'User must belong to a company.' }, { status: 403 });
  }

  const { id: documentId } = await params;

  try {
    const document = await prisma.providerImportDocument.findFirst({
      where: { id: documentId, companyId: user.company.id },
    });

    if (!document) {
      return NextResponse.json({ message: 'Document not found.' }, { status: 404 });
    }

    const body = await req.json();
    const { recordIds } = body;

    if (!recordIds || !Array.isArray(recordIds) || recordIds.length === 0) {
      return NextResponse.json({ message: 'No records selected for import.' }, { status: 400 });
    }

    const records = await prisma.providerImportRecord.findMany({
      where: {
        id: { in: recordIds },
        companyId: user.company.id,
        documentId,
      },
    });

    if (records.length === 0) {
      return NextResponse.json({ message: 'No valid records found to import.' }, { status: 400 });
    }

    // Create imported providers
    const importOps = records.map((record) =>
      prisma.importedProvider.create({
        data: {
          companyId: user.company!.id,
          sourceDocumentId: documentId,
          companyName: record.companyName,
          contactPerson: record.contactPerson,
          email: record.email,
          phone: record.phone,
          address: record.address,
          country: record.country,
          vatId: record.vatId,
          website: record.website,
          notes: record.notes,
        },
      }),
    );

    // Mark imported records
    const updateStatusOps = records.map((record) =>
      prisma.providerImportRecord.update({
        where: { id: record.id },
        data: { status: 'IMPORTED' },
      }),
    );

    // Mark skipped records
    const allRecordIds = (
      await prisma.providerImportRecord.findMany({
        where: { documentId, companyId: user.company.id },
        select: { id: true },
      })
    ).map((r) => r.id);

    const skippedIds = allRecordIds.filter((rid) => !recordIds.includes(rid));
    const skipOps = skippedIds.map((rid) =>
      prisma.providerImportRecord.update({
        where: { id: rid },
        data: { status: 'SKIPPED' },
      }),
    );

    await Promise.all([...importOps, ...updateStatusOps, ...skipOps]);

    return NextResponse.json({
      imported: records.length,
      skipped: skippedIds.length,
      message: `Successfully imported ${records.length} provider${records.length !== 1 ? 's' : ''}.`,
    });
  } catch (err) {
    console.error('[api/provider-import/documents/[id]/import POST]', err);
    return NextResponse.json({ message: 'Import failed' }, { status: 500 });
  }
}
