import { Module } from '@nestjs/common';
import { ERPController } from './erp.controller';
import { ERPService } from './erp.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ERPController],
  providers: [ERPService],
  exports: [ERPService],
})
export class ERPModule {}
