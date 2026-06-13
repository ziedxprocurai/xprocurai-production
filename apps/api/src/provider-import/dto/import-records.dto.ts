import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ImportRecordsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  recordIds!: string[];
}
