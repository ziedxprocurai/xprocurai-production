import { IsString, IsInt, IsBoolean, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ description: 'Product name' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Product description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Product quantity', default: 0 })
  @IsInt()
  @Min(0)
  quantity!: number;

  @ApiProperty({ description: 'Is product available', default: true })
  @IsBoolean()
  isAvailable!: boolean;

  @ApiProperty({ description: 'Is product visible to buyers', default: true })
  @IsBoolean()
  isVisible!: boolean;
}
