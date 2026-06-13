import { IsString, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateERPConnectionDto {
  @ApiProperty({ description: 'Connection string', required: false })
  @IsOptional()
  @IsString()
  connectionString?: string;

  @ApiProperty({ description: 'API key', required: false })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiProperty({ description: 'Credentials (JSON string)', required: false })
  @IsOptional()
  @IsString()
  credentials?: string;

  @ApiProperty({ description: 'Is connection active', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
