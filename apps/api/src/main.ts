import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const port = configService.get<number>('API_PORT', 4000);
  const prefix = configService.get<string>('API_PREFIX', 'api');
  const corsOrigins = configService.get<string>('API_CORS_ORIGINS', 'http://localhost:3000');

  app.setGlobalPrefix(prefix);

  app.enableCors({
    origin: corsOrigins.split(','),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('xProcurAI API')
    .setDescription('B2B SaaS Procurement Intelligence Platform API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${prefix}/docs`, app, document);

  await app.listen(port);
  console.warn(`🚀 API running on http://localhost:${port}/${prefix}`);
  console.warn(`📚 Swagger docs at http://localhost:${port}/${prefix}/docs`);
}

bootstrap();
