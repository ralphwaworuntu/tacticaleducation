import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';

export class HttpError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  const status =
    err instanceof HttpError
      ? err.statusCode
      : err instanceof multer.MulterError
        ? 400
        : 500;
  const message =
    err instanceof multer.MulterError
      ? err.code === 'LIMIT_FILE_SIZE'
        ? 'Ukuran file melebihi batas 15 MB.'
        : err.message
      : err.message || 'Internal Server Error';

  const payload: Record<string, unknown> = {
    status: 'error',
    message,
  };

  if (err instanceof HttpError && err.details) {
    payload.details = err.details;
  }

  if (process.env.NODE_ENV !== 'production') {
    payload.stack = err.stack;
  }

  res.status(status).json(payload);
}
