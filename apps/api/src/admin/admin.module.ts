import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { CompanyModule } from '../company/company.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [CompanyModule, PrismaModule],
  controllers: [AdminController],
  providers: [],
})
export class AdminModule {}
