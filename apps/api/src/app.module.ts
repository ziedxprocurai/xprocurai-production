import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { CompanyModule } from './company/company.module';
import { AdminModule } from './admin/admin.module';
import { ProductModule } from './product/product.module';
import { RFQModule } from './rfq/rfq.module';
import { ERPModule } from './erp/erp.module';
import { ProviderImportModule } from './provider-import/provider-import.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    HealthModule,
    CompanyModule,
    AdminModule,
    ProductModule,
    RFQModule,
    ERPModule,
    ProviderImportModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
