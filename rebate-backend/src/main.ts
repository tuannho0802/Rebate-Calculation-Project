import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { ValidationPipe, HttpException, HttpStatus } from '@nestjs/common';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as path from 'path';

// process.cwd() is always the project root, works for both ts-node and compiled dist
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pjson = require(path.join(process.cwd(), 'package.json'));

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useStaticAssets(join(__dirname, '..', 'public'));

  // Global prefix — exclude the root landing page and the custom JS file
  app.setGlobalPrefix('api', {
    exclude: ['/', 'swagger-custom.js'],
  });

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors) => {
        const fields = errors.map((err) => ({
          field: err.property,
          message: Object.values(err.constraints || {}).join(', '),
        }));
        return new HttpException(
          {
            code: 'VALIDATION_ERROR',
            message: 'Dữ liệu không hợp lệ',
            details: { fields },
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      },
    }),
  );

  app.enableCors({
    origin: [process.env.FRONTEND_URL || 'http://localhost:3000', 'http://localhost:3000'],
    credentials: true,
  });

  // ─── Swagger UI setup ────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'test') {
    const isProd = process.env.NODE_ENV === 'production';
    const version = pjson.version || '0.0.1';

    const config = new DocumentBuilder()
      .setTitle('IB Rebate System API')
      .setDescription(
        'REST API for the IB Rebate Calculation System. ' +
        'Use the **Auto-Login** form in the top bar to authenticate — ' +
        'the token will be applied to all endpoints automatically.',
      )
      .setVersion(version)
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Paste your JWT access token here (without the "Bearer " prefix).',
        },
        'Bearer',
      )
      .addServer('http://localhost:3001', 'Local Development')
      .addServer('https://rebate-calculation-api.vercel.app', 'Production')
      .build();

    const document = SwaggerModule.createDocument(app, config);

    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
      customSiteTitle: 'IB Rebate API Docs',
      customCss: `
        /* ── Topbar ─────────────────────────────────────────────────── */
        .topbar {
          background: #1a1d2e !important;
          border-bottom: 1px solid #2d3148 !important;
          padding: 8px 20px !important;
          min-height: 52px;
        }
        .topbar-wrapper { align-items: center; }
        .topbar-wrapper img { display: none !important; }
        .topbar-wrapper::before {
          content: '🔗 IB Rebate System API';
          color: #00c896;
          font-size: 16px;
          font-weight: 700;
          font-family: Inter, system-ui, -apple-system, sans-serif;
          letter-spacing: 0.01em;
          margin-right: 16px;
        }

        /* ── Hide Smartbear footer / logo ──────────────────────────── */
        .swagger-ui .topbar a[href*="smartbear"],
        .swagger-ui .topbar a[href*="swagger.io"],
        .swagger-ui .info a[href*="swagger"],
        footer { display: none !important; }

        /* ── Info section ───────────────────────────────────────────── */
        .swagger-ui .info .title {
          color: #1e293b;
          font-family: Inter, system-ui, sans-serif;
        }
        .swagger-ui .info .base-url { font-size: 13px; color: #64748b; }

        /* ── Tag headers ────────────────────────────────────────────── */
        .swagger-ui .opblock-tag {
          font-size: 15px !important;
          font-weight: 700 !important;
          font-family: Inter, system-ui, sans-serif !important;
          border-bottom: 1px solid #e2e8f0 !important;
          padding: 12px 0 !important;
          color: #1e293b !important;
        }

        /* ── HTTP method badges ─────────────────────────────────────── */
        .swagger-ui .opblock.opblock-get    .opblock-summary-method { background: #2563eb !important; }
        .swagger-ui .opblock.opblock-post   .opblock-summary-method { background: #059669 !important; }
        .swagger-ui .opblock.opblock-put    .opblock-summary-method { background: #d97706 !important; }
        .swagger-ui .opblock.opblock-patch  .opblock-summary-method { background: #7c3aed !important; }
        .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #dc2626 !important; }
        .swagger-ui .opblock-summary-method {
          min-width: 72px !important;
          border-radius: 5px !important;
          font-size: 12px !important;
          font-weight: 700 !important;
          padding: 6px 0 !important;
        }

        /* ── Response body max-height + scroll ──────────────────────── */
        .swagger-ui .highlight-code,
        .swagger-ui .microlight {
          max-height: 320px !important;
          overflow-y: auto !important;
        }
        .swagger-ui .response-col_description .markdown {
          max-height: 200px;
          overflow-y: auto;
        }

        /* ── Scheme container ───────────────────────────────────────── */
        .swagger-ui .scheme-container {
          background: #f8fafc;
          padding: 16px;
          border-radius: 8px;
          box-shadow: none;
        }

        /* ── Authorize button ───────────────────────────────────────── */
        .swagger-ui .btn.authorize {
          color: #00c896 !important;
          border-color: #00c896 !important;
        }
        .swagger-ui .btn.authorize svg { fill: #00c896 !important; }
      `,
      customJs: ['/swagger-custom.js'],
    });

    if (!isProd) {
      console.log(`📖 Swagger UI: http://localhost:${process.env.PORT || 3001}/api/docs`);
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📡 API prefix:                http://localhost:${port}/api`);
}
bootstrap();
