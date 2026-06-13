import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Handle Prisma errors
    if (exception.code) {
      let status = HttpStatus.INTERNAL_SERVER_ERROR;
      let message = 'Database error';

      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          message = 'Unique constraint violation';
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          message = 'Record not found';
          break;
        case 'P2003':
          status = HttpStatus.BAD_REQUEST;
          message = 'Foreign key constraint failed';
          break;
      }

      return response.status(status).json({
        statusCode: status,
        message,
        error: exception.code,
      });
    }

    // Handle HTTP exceptions
    if (exception.getStatus && typeof exception.getStatus === 'function') {
      const status = exception.getStatus();
      return response.status(status).json({
        statusCode: status,
        message: exception.message || 'An error occurred',
        error: exception.name,
      });
    }

    // Handle all other errors
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: exception.message || 'Internal server error',
      error: 'InternalServerError',
    });
  }
}
