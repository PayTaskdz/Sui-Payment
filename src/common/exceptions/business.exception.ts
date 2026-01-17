import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessException extends HttpException {
  constructor(
    message: string,
    errorCode: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: any,
  ) {
    super(
      {
        error_code: errorCode,
        message,
        details,
      },
      statusCode,
    );
  }
}
