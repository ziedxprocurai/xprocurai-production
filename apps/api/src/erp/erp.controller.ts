import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ERPService } from './erp.service';
import { CreateERPConnectionDto } from './dto/create-erp-connection.dto';
import { UpdateERPConnectionDto } from './dto/update-erp-connection.dto';

@ApiTags('ERP')
@ApiBearerAuth()
@Controller('erp')
@UseGuards(JwtAuthGuard)
export class ERPController {
  constructor(private readonly erpService: ERPService) {}

  @Post()
  @ApiOperation({ summary: 'Create ERP connection (Suppliers only)' })
  @ApiResponse({ status: 201, description: 'ERP connection created successfully' })
  @ApiResponse({ status: 403, description: 'Only suppliers can create ERP connections' })
  @ApiResponse({ status: 409, description: 'Company already has an ERP connection' })
  async create(@Request() req: any, @Body() dto: CreateERPConnectionDto) {
    return this.erpService.create(req.user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get ERP connection for current company' })
  @ApiResponse({ status: 200, description: 'ERP connection details' })
  @ApiResponse({ status: 404, description: 'No ERP connection found' })
  async findByCompany(@Request() req: any) {
    return this.erpService.findByCompany(req.user.userId);
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update ERP connection' })
  @ApiResponse({ status: 200, description: 'ERP connection updated successfully' })
  @ApiResponse({ status: 404, description: 'No ERP connection found' })
  async update(@Request() req: any, @Body() dto: UpdateERPConnectionDto) {
    return this.erpService.update(req.user.userId, dto);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete ERP connection' })
  @ApiResponse({ status: 200, description: 'ERP connection deleted successfully' })
  @ApiResponse({ status: 404, description: 'No ERP connection found' })
  async delete(@Request() req: any) {
    return this.erpService.delete(req.user.userId);
  }
}
