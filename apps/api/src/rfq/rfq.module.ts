import { Module } from '@nestjs/common';
import { RFQController } from './rfq.controller';
import { RFQService } from './rfq.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RFQController],
  providers: [RFQService],
  exports: [RFQService],
})
export class RFQModule {}
