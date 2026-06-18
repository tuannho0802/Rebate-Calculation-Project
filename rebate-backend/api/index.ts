import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import express from 'express';

let cachedServer: any;

async function bootstrap() {
    const server = express();
    const app = await NestFactory.create<NestExpressApplication>(
        AppModule,
        new ExpressAdapter(server),
    );

    // Setup Swagger TRƯỚC khi setGlobalPrefix
    const config = new DocumentBuilder()
        .setTitle('IB Rebate API')
        .setDescription('Rebate Calculation System')
        .setVersion('1.0')
        .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'Bearer')
        .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
        customCssUrl: 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui.min.css',
        customJs: [
            'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui-bundle.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui-standalone-preset.min.js',
        ],
    });

    // setGlobalPrefix SAU Swagger setup, exclude docs
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