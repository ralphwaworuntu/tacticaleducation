import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { HttpError } from './errorHandler';

export function validateResource(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      const formatted = result.error.flatten();
      return next(new HttpError('Invalid request payload', 422, formatted));
    }

    const parsed = result.data as {
      body?: unknown;
      query?: Record<string, unknown>;
      params?: Record<string, string>;
    };
    const { body, query, params } = parsed;
    if (body) {
      req.body = body;
    }
    if (params) {
      req.params = params;
    }
    if (query) {
      const target = req.query as Record<string, unknown>;
      Object.keys(target).forEach((key) => {
        delete target[key];
      });
      Object.assign(target, query);
    }
    return next();
  };
}
