import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RFQService } from './rfq.service';
import { CreateRFQDto } from './dto/create-rfq.dto';
import { UpdateRFQDto } from './dto/update-rfq.dto';

@ApiTags('RFQ')
@ApiBearerAuth()
@Controller('rfqs')
@UseGuards(JwtAuthGuard)
export class RFQController {
  constructor(private readonly rfqService: RFQService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new RFQ (Buyers only)' })
  @ApiResponse({ status: 201, description: 'RFQ created successfully' })
  @ApiResponse({ status: 403, description: 'Only buyers can create RFQs' })
  async create(@Request() req: any, @Body() dto: CreateRFQDto) {
    return this.rfqService.create(req.user.userId, dto);
  }

  @Get('sent')
  @ApiOperation({ summary: 'Get all RFQs sent by the current company' })
  @ApiResponse({ status: 200, description: 'List of sent RFQs' })
  async findSent(@Request() req: any) {
    return this.rfqService.findSentRFQs(req.user.userId);
  }

  @Get('received')
  @ApiOperation({ summary: 'Get all RFQs received by the current company' })
  @ApiResponse({ status: 200, description: 'List of received RFQs' })
  async findReceived(@Request() req: any) {
    return this.rfqService.findReceivedRFQs(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific RFQ' })
  @ApiResponse({ status: 200, description: 'RFQ details' })
  @ApiResponse({ status: 404, description: 'RFQ not found' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.rfqService.findOne(id, req.user.userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an RFQ (Suppliers only)' })
  @ApiResponse({ status: 200, description: 'RFQ updated successfully' })
  @ApiResponse({ status: 404, description: 'RFQ not found' })
  async update(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: UpdateRFQDto,
  ) {
    return this.rfqService.update(id, req.user.userId, dto);
  }
}
