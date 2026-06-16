import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Đã có lỗi xảy ra, vui lòng thử lại';
    let details = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;
      
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        code = exceptionResponse.code || this.mapStatusToErrorCode(status);
        message = exceptionResponse.message || exception.message;
        details = exceptionResponse.details || {};
      } else {
        code = this.mapStatusToErrorCode(status);
        message = exception.message;
      }
    } else {
      // Database or server error
      console.error(exception);
      code = 'DATABASE_ERROR';
      message = exception.message || 'Đã có lỗi xảy ra, vui lòng thử lại';
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        details,
      },
    });
  }

  private mapStatusToErrorCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'VALIDATION_ERROR';
      case HttpStatus.UNAUTHORIZED:
        return 'AUTH_TOKEN_INVALID';
      case HttpStatus.FORBIDDEN:
        return 'AUTH_FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'RESOURCE_NOT_FOUND';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'VALIDATION_ERROR';
      default:
        return 'INTERNAL_ERROR';
    }
  }
}
