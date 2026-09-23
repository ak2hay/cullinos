import { config as loadEnv } from "dotenv";
import { existsSync, mkdirSync } from "fs";
import { resolve } from "path";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import {
  assertProductionSecurityConfig,
  createCorsOriginDelegate,
  parseCorsOrigins,
} from "./common/cors.util";
import { initSentry } from "./common/sentry.init";

// Monorepo root .env (apps/api/src|dist → ../../../.env)
const rootEnvPath = resolve(__dirname, "../../../.env");
if (existsSync(rootEnvPath)) {
  loadEnv({ path: rootEnvPath });
}

async function bootstrap() {
  await initSentry();
  assertProductionSecurityConfig();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // Local-disk marketing uploads (when R2 is unset). Served at /cms/* outside api/v1.
  const marketingUploadDir =
    process.env.MARKETING_UPLOAD_DIR ||
    resolve(process.cwd(), "../web/public/cms");
  try {
    mkdirSync(marketingUploadDir, { recursive: true });
    app.useStaticAssets(marketingUploadDir, {
      prefix: "/cms",
      setHeaders: (res) => {
        res.setHeader("Cache-Control", "public, max-age=86400");
      },
    });
  } catch {
    // Non-fatal — R2-only deployments may omit a writable upload dir.
  }

  const allowedOrigins = new Set(parseCorsOrigins(process.env.CORS_ORIGINS));
  // Local/dev default when unset: reflect nothing; require explicit list or empty (no browser CORS).
  if (process.env.NODE_ENV !== "production" && allowedOrigins.size === 0) {
    for (const origin of [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5177",
      "http://localhost:5178",
      "http://localhost:5180",
      "http://localhost:5183",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5174",
    ]) {
      allowedOrigins.add(origin);
    }
  }

  app.enableCors({
    credentials: true,
    origin: createCorsOriginDelegate(allowedOrigins),
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const enableSwagger =
    process.env.NODE_ENV !== "production" && process.env.ENABLE_SWAGGER !== "false";
  if (enableSwagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Cullinos API")
      .setDescription("Restaurant management platform — full API reference")
      .setVersion("1.0")
      .addBearerAuth(
        { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        "access-token",
      )
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("docs", app, document);
  }

  app.setGlobalPrefix("api/v1");
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3000);
  await app.listen(port, "0.0.0.0");
  console.log(`Cullinos API running on port ${port}`);
}

bootstrap();
