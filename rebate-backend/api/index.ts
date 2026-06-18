import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import express from 'express';

let cachedServer: any;

const swaggerHtml = `<!DOCTYPE html>
<html>
<head>
  <title>IB Rebate System API</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.29.1/swagger-ui.min.css">
  <link rel="stylesheet" href="/swagger-custom.css">
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.29.1/swagger-ui-bundle.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.29.1/swagger-ui-standalone-preset.min.js"></script>
<script src="/swagger-custom.js"></script>
<script src="/swagger-inject.js"></script>
<script>
window.onload = function() {
  window.ui = SwaggerUIBundle({
    url: '/api/docs-json',
    dom_id: '#swagger-ui',
    deepLinking: true,
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
    plugins: [SwaggerUIBundle.plugins.DownloadUrl],
    layout: 'StandaloneLayout',
    persistAuthorization: true,
  });
};
</script>
</body>
</html>`;

async function bootstrap() {
    const server = express();

    // Serve custom Swagger HTML trước khi NestJS init
    server.get('/api/docs', (_req, res) => {
        res.setHeader('Content-Type', 'text/html');
        res.send(swaggerHtml);
    });

    const app = await NestFactory.create<NestExpressApplication>(
        AppModule,
        new ExpressAdapter(server),
    );

    // Chỉ cần setup docs-json endpoint (spec JSON)
    const config = new DocumentBuilder()
        .setTitle('IB Rebate System API')
        .setDescription('Rebate Calculation System')
        .setVersion('1.0')
        .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'Bearer')
        .build();
    const document = SwaggerModule.createDocument(app, config);
    // Setup ở path khác để lấy JSON spec, không dùng HTML của nó
    SwaggerModule.setup('api/docs', app, document, {
        swaggerOptions: { persistAuthorization: true },
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