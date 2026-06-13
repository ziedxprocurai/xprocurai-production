import { Module } from '@nestjs/common';
import { ProviderImportController } from './provider-import.controller';
import { ProviderImportService } from './provider-import.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ProviderImportController],
  providers: [ProviderImportService],
  exports: [ProviderImportService],
})
export class ProviderImportModule {}
