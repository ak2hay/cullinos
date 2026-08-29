import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { API_PREFIX } from '@cullinos/shared';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.use(helmet());
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || true,
    credentials: true,
  });

  app.setGlobalPrefix(API_PREFIX.replace('/api/v1', 'api'));
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('Cullinos API')
    .setDescription('Cullinos Restaurant Operating System API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const parsePort = (value: string | undefined, fallback: number): number => {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 && n < 65536 ? n : fallback;
  };

  // Railway sets PORT; local dev can use API_PORT in .env
  const port = parsePort(process.env.PORT ?? process.env.API_PORT, 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`Cullinos API running on port ${port}`);
}

bootstrap();
