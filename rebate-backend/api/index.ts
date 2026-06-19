import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe, HttpException, HttpStatus } from '@nestjs/common';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import express from 'express';

let cachedServer: any;

async function bootstrap() {
    const server = express();

    const app = await NestFactory.create<NestExpressApplication>(
        AppModule,
        new ExpressAdapter(server),
    );

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
                    { code: 'VALIDATION_ERROR', message: 'Dữ liệu không hợp lệ', details: { fields } },
                    HttpStatus.UNPROCESSABLE_ENTITY,
                );
            },
        }),
    );

    const config = new DocumentBuilder()
        .setTitle('Hệ thống Rebate IB API')
        .setDescription('REST API cho hệ thống tính toán Rebate IB. Xem hướng dẫn bên dưới.')
        .setVersion('1.0')
        .addBearerAuth(
            {
                type: 'http', scheme: 'bearer', bearerFormat: 'JWT',
                description: 'Paste your JWT access token here (without the "Bearer " prefix).',
            },
            'Bearer',
        )
        .addServer('https://rebate-calculation-api.vercel.app', 'Production')
        .addServer('http://localhost:3001', 'Local Development')
        .build();

    const document = SwaggerModule.createDocument(app, config);

    // Y CHANG main.ts — để NestJS tự render HTML, không custom HTML riêng
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
        customJs: ['/swagger-inject.js'],
    });

    app.setGlobalPrefix('api', {
        exclude: ['api/docs', 'api/docs/(.*)'],
    });

    app.enableCors();
    await app.init();
    return server;
}

export default async function handler(req: any, res: any) {
    if (!cachedServer) {
        cachedServer = await bootstrap();
    }
    cachedServer(req, res);
}