import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new product (Suppliers only)' })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  @ApiResponse({ status: 403, description: 'Only suppliers can create products' })
  async create(@Request() req: any, @Body() dto: CreateProductDto) {
    return this.productService.create(req.user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all products for the current company' })
  @ApiResponse({ status: 200, description: 'List of products' })
  async findAll(@Request() req: any) {
    return this.productService.findAll(req.user.userId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search available products from verified suppliers' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiResponse({ status: 200, description: 'List of matching products' })
  async search(@Query('q') query: string) {
    return this.productService.searchProducts(query || '');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific product' })
  @ApiResponse({ status: 200, description: 'Product details' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.productService.findOne(id, req.user.userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a product' })
  @ApiResponse({ status: 200, description: 'Product updated successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async update(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productService.update(id, req.user.userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a product' })
  @ApiResponse({ status: 200, description: 'Product deleted successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.productService.remove(id, req.user.userId);
  }
}
