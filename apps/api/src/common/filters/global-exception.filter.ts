import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { ApiErrorResponse } from './api-error';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<FastifyReply>();

    if (exception instanceof UnauthorizedException) {
      return this.send(response, HttpStatus.UNAUTHORIZED, {
        error: { code: 'unauthorized', message: exception.message },
      });
    }

    if (exception instanceof ForbiddenException) {
      return this.send(response, HttpStatus.FORBIDDEN, {
        error: { code: 'forbidden', message: exception.message },
      });
    }

    if (exception instanceof NotFoundException) {
      return this.send(response, HttpStatus.NOT_FOUND, {
        error: { code: 'not_found', message: exception.message },
      });
    }

    if (exception instanceof ConflictException) {
      return this.send(response, HttpStatus.CONFLICT, {
        error: { code: 'conflict', message: exception.message },
      });
    }

    if (exception instanceof HttpException) {
      return this.send(response, HttpStatus.BAD_REQUEST, {
        error: {
          code: 'validation_error',
          message: exception.message,
          details: exception.getResponse(),
        },
      });
    }

    return this.send(response, HttpStatus.INTERNAL_SERVER_ERROR, {
      error: { code: 'validation_error', message: 'Unexpected error' },
    });
  }

  private send(response: FastifyReply, statusCode: number, body: ApiErrorResponse): void {
    response.status(statusCode).send(body);
  }
}
