import {
  Controller,
  Get,
  Patch,
  Put,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CompanyService } from '../company/company.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingDto } from './dto/update-setting.dto';

enum VerificationStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

class UpdateVerificationStatusDto {
  @IsEnum(VerificationStatus)
  status!: VerificationStatus;
}

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly companyService: CompanyService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('companies')
  @ApiOperation({ summary: 'Get all companies (Admin only)' })
  @ApiResponse({ status: 200, description: 'List of all companies' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getAllCompanies() {
    return this.companyService.findAll();
  }

  @Patch('companies/:id/verification-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update company verification status (Admin only)' })
  @ApiResponse({ status: 200, description: 'Verification status updated' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async updateVerificationStatus(
    @Param('id') id: string,
    @Body() dto: UpdateVerificationStatusDto,
  ) {
    return this.companyService.updateVerificationStatus(id, dto.status);
  }

  @Get('settings/provider-import')
  @ApiOperation({ summary: 'Get provider import AI settings (Admin only)' })
  @ApiResponse({ status: 200, description: 'Provider import settings' })
  async getProviderImportSettings() {
    const setting = await this.prisma.adminSetting.findUnique({
      where: { key: 'PROVIDER_IMPORT_AI_API_KEY' },
    });
    return {
      hasApiKey: !!setting?.value,
      keyPreview: setting?.value
        ? `${setting.value.slice(0, 8)}${'*'.repeat(20)}`
        : null,
      updatedAt: setting?.updatedAt ?? null,
    };
  }

  @Put('settings/provider-import')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update provider import AI API key (Admin only)' })
  @ApiResponse({ status: 200, description: 'Settings updated' })
  async updateProviderImportSettings(@Body() dto: UpdateSettingDto) {
    const setting = await this.prisma.adminSetting.upsert({
      where: { key: 'PROVIDER_IMPORT_AI_API_KEY' },
      update: { value: dto.value },
      create: { key: 'PROVIDER_IMPORT_AI_API_KEY', value: dto.value },
    });
    return {
      hasApiKey: true,
      keyPreview: `${setting.value.slice(0, 8)}${'*'.repeat(20)}`,
      updatedAt: setting.updatedAt,
      message: 'API key saved successfully.',
    };
  }

  @Get('settings/provider-import/test')
  @ApiOperation({ summary: 'Test provider import AI API key (Admin only)' })
  @ApiResponse({ status: 200, description: 'Test result' })
  async testProviderImportApiKey() {
    const setting = await this.prisma.adminSetting.findUnique({
      where: { key: 'PROVIDER_IMPORT_AI_API_KEY' },
    });

    if (!setting?.value) {
      return { success: false, message: 'No API key configured.' };
    }

    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(setting.value);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      await model.generateContent('Reply with the word OK only.');
      return { success: true, message: 'Gemini API key is valid and working.' };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Gemini API key validation failed.',
      };
    }
  }
}
