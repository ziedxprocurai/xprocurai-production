import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsArray,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum CompanyRoleDto {
  BUYER = 'BUYER',
  SUPPLIER = 'SUPPLIER',
}

export enum CompanySizeDto {
  SOLE_PROPRIETOR = 'SOLE_PROPRIETOR',
  SMALL = 'SMALL',
  MEDIUM = 'MEDIUM',
  LARGE = 'LARGE',
  ENTERPRISE = 'ENTERPRISE',
}

export class CreateCompanyDto {
  @ApiProperty({ example: 'Acme Corporation' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  legalName!: string;

  @ApiPropertyOptional({ example: 'https://acme.com' })
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiProperty({ example: 'United States' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  country!: string;

  @ApiPropertyOptional({ example: 'New York' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 'Manufacturing' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @ApiPropertyOptional({ enum: CompanySizeDto, example: 'MEDIUM' })
  @IsOptional()
  @IsEnum(CompanySizeDto)
  companySize?: CompanySizeDto;

  @ApiPropertyOptional({ example: '+1-555-0100' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'contact@acme.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Global manufacturing leader' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ enum: CompanyRoleDto, isArray: true, example: ['BUYER'] })
  @IsArray()
  @IsEnum(CompanyRoleDto, { each: true })
  roles!: CompanyRoleDto[];
}
