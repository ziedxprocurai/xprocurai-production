import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Company')
@Controller('companies')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Post()
  @ApiOperation({ summary: 'Create a company and assign the current user to it' })
  async create(
    @Body() dto: CreateCompanyDto,
    @Request() req: { user: { userId: string } },
  ) {
    return this.companyService.create(dto, req.user.userId);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get the current user\'s company' })
  async getMyCompany(@Request() req: { user: { userId: string } }) {
    return this.companyService.findByUserId(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a company by ID' })
  @ApiParam({ name: 'id', type: String })
  async findById(@Param('id') id: string) {
    return this.companyService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a company' })
  @ApiParam({ name: 'id', type: String })
  async update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.companyService.update(id, dto);
  }

  @Post(':id/complete-onboarding')
  @ApiOperation({ summary: 'Mark company onboarding as completed' })
  @ApiParam({ name: 'id', type: String })
  async completeOnboarding(@Param('id') id: string) {
    return this.companyService.completeOnboarding(id);
  }

  @Post(':id/users/:userId')
  @ApiOperation({ summary: 'Add a user to a company' })
  async addUser(
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.companyService.addUser(id, userId);
  }
}
