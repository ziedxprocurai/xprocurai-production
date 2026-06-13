import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

enum RFQStatus {
  PENDING = 'PENDING',
  REVIEWED = 'REVIEWED',
  RESPONDED = 'RESPONDED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

export class UpdateRFQDto {
  @ApiProperty({ description: 'RFQ status', enum: RFQStatus, required: false })
  @IsOptional()
  @IsEnum(RFQStatus)
  status?: RFQStatus;

  @ApiProperty({ description: 'Supplier response', required: false })
  @IsOptional()
  @IsString()
  response?: string;
}
