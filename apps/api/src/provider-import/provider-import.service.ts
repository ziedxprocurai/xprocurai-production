import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateRecordDto } from './dto/update-record.dto';

const ALLOWED_EXTENSIONS = ['.csv', '.xls', '.xlsx'];
const MAX_ROWS_FOR_AI = 100;

@Injectable()
export class ProviderImportService {
  private readonly logger = new Logger(ProviderImportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async uploadAndExtract(file: Express.Multer.File, userId: string) {
    const fileExt = path.extname(file.originalname).toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
      throw new BadRequestException(
        'Invalid file type. Only CSV, XLS, and XLSX files are allowed.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });

    if (!user?.company) {
      throw new ForbiddenException(
        'User must belong to a company to import providers.',
      );
    }

    let parsedRows: Record<string, unknown>[];
    try {
      parsedRows = this.parseFile(file.buffer);
    } catch (err: any) {
      throw new BadRequestException(
        `Failed to parse file: ${err.message || 'Unknown parse error'}`,
      );
    }

    if (!parsedRows || parsedRows.length === 0) {
      throw new BadRequestException(
        'The file appears to be empty or could not be parsed.',
      );
    }

    const document = await this.prisma.providerImportDocument.create({
      data: {
        fileName: file.originalname,
        fileSize: file.size,
        fileType: fileExt.slice(1).toUpperCase(),
        status: 'PROCESSING',
        companyId: user.company.id,
      },
    });

    try {
      await this.extractWithAI(parsedRows, user.company.id, document.id);

      await this.prisma.providerImportDocument.update({
        where: { id: document.id },
        data: { status: 'EXTRACTED' },
      });

      return this.prisma.providerImportDocument.findUnique({
        where: { id: document.id },
        include: {
          records: { orderBy: { createdAt: 'asc' } },
          _count: { select: { records: true } },
        },
      });
    } catch (err: any) {
      this.logger.error(
        `AI extraction failed for document ${document.id}: ${err.message}`,
      );

      await this.prisma.providerImportDocument.update({
        where: { id: document.id },
        data: {
          status: 'FAILED',
          errorMessage: err.message || 'AI extraction failed',
        },
      });

      throw new InternalServerErrorException(
        err.message || 'AI extraction failed. Please check your AI API key settings.',
      );
    }
  }

  private parseFile(buffer: Buffer): Record<string, unknown>[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error('No sheets found in the file.');
    }
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: null,
    });
    return rows;
  }

  private async extractWithAI(
    rows: Record<string, unknown>[],
    companyId: string,
    documentId: string,
  ): Promise<void> {
    const apiKeySetting = await this.prisma.adminSetting.findUnique({
      where: { key: 'PROVIDER_IMPORT_AI_API_KEY' },
    });

    if (!apiKeySetting?.value) {
      throw new Error(
        'AI API key is not configured. Please ask your platform administrator to set it up.',
      );
    }

    const genAI = new GoogleGenerativeAI(apiKeySetting.value);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
    });

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
      throw new Error(
        'AI could not extract any provider records from the file. Please check the file format.',
      );
    }

    const createOps = providers.map((provider) =>
      this.prisma.providerImportRecord.create({
        data: {
          documentId,
          companyId,
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
    this.logger.log(
      `Extracted ${providers.length} records for document ${documentId}`,
    );
  }

  async getDocuments(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });

    if (!user?.company) {
      throw new ForbiddenException('User must belong to a company.');
    }

    return this.prisma.providerImportDocument.findMany({
      where: { companyId: user.company.id },
      include: {
        _count: { select: { records: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDocument(id: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });

    if (!user?.company) {
      throw new ForbiddenException('User must belong to a company.');
    }

    const document = await this.prisma.providerImportDocument.findFirst({
      where: { id, companyId: user.company.id },
      include: {
        records: { orderBy: { createdAt: 'asc' } },
        _count: { select: { records: true } },
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found.');
    }

    return document;
  }

  async updateRecord(id: string, userId: string, dto: UpdateRecordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });

    if (!user?.company) {
      throw new ForbiddenException('User must belong to a company.');
    }

    const record = await this.prisma.providerImportRecord.findFirst({
      where: { id, companyId: user.company.id },
    });

    if (!record) {
      throw new NotFoundException('Record not found.');
    }

    return this.prisma.providerImportRecord.update({
      where: { id },
      data: {
        ...(dto.companyName !== undefined && { companyName: dto.companyName }),
        ...(dto.contactPerson !== undefined && { contactPerson: dto.contactPerson }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.vatId !== undefined && { vatId: dto.vatId }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.isSelected !== undefined && { isSelected: dto.isSelected }),
      },
    });
  }

  async importRecords(documentId: string, userId: string, recordIds: string[]) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });

    if (!user?.company) {
      throw new ForbiddenException('User must belong to a company.');
    }

    const document = await this.prisma.providerImportDocument.findFirst({
      where: { id: documentId, companyId: user.company.id },
    });

    if (!document) {
      throw new NotFoundException('Document not found.');
    }

    const records = await this.prisma.providerImportRecord.findMany({
      where: {
        id: { in: recordIds },
        companyId: user.company.id,
        documentId,
      },
    });

    if (records.length === 0) {
      throw new BadRequestException('No valid records found to import.');
    }

    const importOps = records.map((record) =>
      this.prisma.importedProvider.create({
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

    const updateStatusOps = records.map((record) =>
      this.prisma.providerImportRecord.update({
        where: { id: record.id },
        data: { status: 'IMPORTED' },
      }),
    );

    const skippedIds = (
      await this.prisma.providerImportRecord.findMany({
        where: { documentId, companyId: user.company.id },
        select: { id: true },
      })
    )
      .map((r) => r.id)
      .filter((id) => !recordIds.includes(id));

    const skipOps = skippedIds.map((id) =>
      this.prisma.providerImportRecord.update({
        where: { id },
        data: { status: 'SKIPPED' },
      }),
    );

    await Promise.all([...importOps, ...updateStatusOps, ...skipOps]);

    return {
      imported: records.length,
      skipped: skippedIds.length,
      message: `Successfully imported ${records.length} provider${records.length !== 1 ? 's' : ''}.`,
    };
  }

  async deleteDocument(id: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });

    if (!user?.company) {
      throw new ForbiddenException('User must belong to a company.');
    }

    const document = await this.prisma.providerImportDocument.findFirst({
      where: { id, companyId: user.company.id },
    });

    if (!document) {
      throw new NotFoundException('Document not found.');
    }

    await this.prisma.providerImportDocument.delete({ where: { id } });

    return { message: 'Document deleted successfully.' };
  }

  async getImportedProviders(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });

    if (!user?.company) {
      throw new ForbiddenException('User must belong to a company.');
    }

    return this.prisma.importedProvider.findMany({
      where: { companyId: user.company.id },
      orderBy: { createdAt: 'desc' },
    });
  }
}
