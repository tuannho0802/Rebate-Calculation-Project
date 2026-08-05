"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const core_1 = require("@nestjs/core");
const platform_express_1 = require("@nestjs/platform-express");
const app_module_1 = require("../src/app.module");
const swagger_1 = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const response_interceptor_1 = require("../src/common/interceptors/response.interceptor");
const http_exception_filter_1 = require("../src/common/filters/http-exception.filter");
const express_1 = __importDefault(require("express"));
let cachedServer;
async function bootstrap() {
    const server = (0, express_1.default)();
    const app = await core_1.NestFactory.create(app_module_1.AppModule, new platform_express_1.ExpressAdapter(server));
    app.useGlobalInterceptors(new response_interceptor_1.ResponseInterceptor());
    app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter());
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        exceptionFactory: (errors) => {
            const fields = errors.map((err) => ({
                field: err.property,
                message: Object.values(err.constraints || {}).join(', '),
            }));
            return new common_1.HttpException({ code: 'VALIDATION_ERROR', message: 'Dữ liệu không hợp lệ', details: { fields } }, common_1.HttpStatus.UNPROCESSABLE_ENTITY);
        },
    }));
    const config = new swagger_1.DocumentBuilder()
        .setTitle('Hệ thống Rebate IB API')
        .setDescription('REST API cho hệ thống tính toán Rebate IB. Xem hướng dẫn bên dưới.')
        .setVersion('1.0')
        .addBearerAuth({
        type: 'http', scheme: 'bearer', bearerFormat: 'JWT',
        description: 'Paste your JWT access token here (without the "Bearer " prefix).',
    }, 'Bearer')
        .addServer('https://rebate-calculation-api.vercel.app', 'Production')
        .addServer('http://localhost:3001', 'Local Development')
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('api/docs', app, document, {
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
    app.setGlobalPrefix('api', {
        exclude: ['api/docs', 'api/docs/(.*)'],
    });
    app.enableCors();
    await app.init();
    return server;
}
async function handler(req, res) {
    if (!cachedServer) {
        cachedServer = await bootstrap();
    }
    cachedServer(req, res);
}
//# sourceMappingURL=index.js.map