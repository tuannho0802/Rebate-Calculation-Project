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
    app.setGlobalPrefix('api');
    app.enableCors();

    const config = new DocumentBuilder()
        .setTitle('IB Rebate API')
        .setDescription('Rebate Calculation System')
        .setVersion('1.0')
        .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'Bearer')
        .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    await app.init();
    return server;
}

export default async function handler(req: any, res: any) {
    if (!cachedServer) {
        cachedServer = await bootstrap();
    }
    cachedServer(req, res);
}