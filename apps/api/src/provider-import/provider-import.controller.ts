import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProviderImportService } from './provider-import.service';
import { UpdateRecordDto } from './dto/update-record.dto';
import { ImportRecordsDto } from './dto/import-records.dto';

const TEN_MB = 10 * 1024 * 1024;

@ApiTags('Provider Import')
@ApiBearerAuth()
@Controller('provider-import')
@UseGuards(JwtAuthGuard)
export class ProviderImportController {
  constructor(private readonly service: ProviderImportService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a CSV/XLS/XLSX file and extract providers via AI' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded and providers extracted' })
  @ApiResponse({ status: 400, description: 'Invalid file type or empty file' })
  @ApiResponse({ status: 500, description: 'AI extraction failed' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: TEN_MB },
    }),
  )
  async upload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: TEN_MB })],
      }),
    )
    file: Express.Multer.File,
    @Request() req: { user: { userId: string } },
  ) {
    return this.service.uploadAndExtract(file, req.user.userId);
  }

  @Get('documents')
  @ApiOperation({ summary: 'List all import documents for the current company' })
  @ApiResponse({ status: 200, description: 'List of documents' })
  async getDocuments(@Request() req: { user: { userId: string } }) {
    return this.service.getDocuments(req.user.userId);
  }

  @Get('documents/:id')
  @ApiOperation({ summary: 'Get a document with its extracted records' })
  @ApiResponse({ status: 200, description: 'Document with records' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async getDocument(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
  ) {
    return this.service.getDocument(id, req.user.userId);
  }

  @Patch('records/:id')
  @ApiOperation({ summary: 'Update a single extracted record' })
  @ApiResponse({ status: 200, description: 'Record updated' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  async updateRecord(
    @Param('id') id: string,
    @Body() dto: UpdateRecordDto,
    @Request() req: { user: { userId: string } },
  ) {
    return this.service.updateRecord(id, req.user.userId, dto);
  }

  @Post('documents/:id/import')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Import selected records into the company provider database' })
  @ApiResponse({ status: 200, description: 'Records imported successfully' })
  @ApiResponse({ status: 400, description: 'No records to import' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async importRecords(
    @Param('id') documentId: string,
    @Body() dto: ImportRecordsDto,
    @Request() req: { user: { userId: string } },
  ) {
    return this.service.importRecords(documentId, req.user.userId, dto.recordIds);
  }

  @Delete('documents/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an import document and all its records' })
  @ApiResponse({ status: 200, description: 'Document deleted' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async deleteDocument(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
  ) {
    return this.service.deleteDocument(id, req.user.userId);
  }

  @Get('imported-providers')
  @ApiOperation({ summary: 'List all imported providers for the current company' })
  @ApiResponse({ status: 200, description: 'List of imported providers' })
  async getImportedProviders(@Request() req: { user: { userId: string } }) {
    return this.service.getImportedProviders(req.user.userId);
  }
}
