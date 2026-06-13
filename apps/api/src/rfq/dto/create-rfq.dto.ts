import { IsString, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRFQDto {
  @ApiProperty({ description: 'RFQ title' })
  @IsString()
  title!: string;

  @ApiProperty({ description: 'RFQ description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Requested quantity', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiProperty({ description: 'Supplier company ID' })
  @IsString()
  supplierId!: string;

  @ApiProperty({ description: 'Product ID (optional)', required: false })
  @IsOptional()
  @IsString()
  productId?: string;
}
