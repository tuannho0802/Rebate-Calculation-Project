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
    exclude: ['/', 'swagger-custom.js', 'swagger-inject.js'],
  });

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors) => {
        const flattenErrors = (errs: any[], parentProperty: string = ''): any[] => {
          let flatErrs: any[] = [];
          errs.forEach((err) => {
            const propertyPath = parentProperty ? `${parentProperty}.${err.property}` : err.property;
            if (err.constraints) {
              flatErrs.push({
                field: propertyPath,
                message: Object.values(err.constraints).join(', '),
              });
            }
            if (err.children && err.children.length > 0) {
              flatErrs.push(...flattenErrors(err.children, propertyPath));
            }
          });
          return flatErrs;
        };

        const fields = flattenErrors(errors);

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
      .setTitle('Hệ thống Rebate IB API')
      .setDescription('REST API cho hệ thống tính toán Rebate IB. Xem hướng dẫn bên dưới.')
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
      customCssUrl: '/swagger-custom.css',
      customJs: ['/swagger-inject.js', '/swagger-custom.js'],
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
