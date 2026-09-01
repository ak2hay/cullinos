import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

function formatMessage(value: unknown, fallback: string): string {
  if (Array.isArray(value)) {
    return value.map(String).join(', ');
  }
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return fallback;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let details: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();
      if (typeof exResponse === 'object' && exResponse !== null) {
        const obj = exResponse as Record<string, unknown>;
        message = formatMessage(obj.message, exception.message);
        code = (obj.code as string) || 'HTTP_ERROR';
        details = obj.details as Record<string, unknown>;
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      code = exception.code;
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'A record with this value already exists';
      } else if (exception.code === 'P2003') {
        status = HttpStatus.BAD_REQUEST;
        message = 'Related record not found';
      } else {
        status = HttpStatus.BAD_REQUEST;
        message = exception.message;
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      code = 'PRISMA_VALIDATION_ERROR';
      message = 'Invalid data submitted';
    }

    response.status(status).json({
      error: { code, message, details },
    });
  }
}
