import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSettingDto {
  @ApiProperty({
    description: 'The setting value',
    example: 'AIzaSyD...',
  })
  @IsString()
  @IsNotEmpty()
  value!: string;
}
