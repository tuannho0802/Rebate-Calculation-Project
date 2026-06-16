import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, HttpException, HttpStatus } from '@nestjs/common';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
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

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}/api`);
}
bootstrap();

