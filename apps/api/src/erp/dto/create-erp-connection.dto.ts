import { IsEnum, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

enum ERPSystem {
  SAP = 'SAP',
  ORACLE_NETSUITE = 'ORACLE_NETSUITE',
  MICROSOFT_DYNAMICS_365 = 'MICROSOFT_DYNAMICS_365',
}

export class CreateERPConnectionDto {
  @ApiProperty({ description: 'ERP System', enum: ERPSystem })
  @IsEnum(ERPSystem)
  erpSystem!: ERPSystem;

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
}
