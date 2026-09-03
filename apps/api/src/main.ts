import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Swagger UI — must be set up before setGlobalPrefix so /docs is accessible
  const swaggerConfig = new DocumentBuilder()
    .setTitle("Cullinos API")
    .setDescription("Restaurant management platform — full API reference")
    .setVersion("1.0")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "access-token")
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  app.setGlobalPrefix("api/v1");
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3000);
  await app.listen(port, "0.0.0.0");
  console.log(`Cullinos API running on port ${port}`);
}

bootstrap();
