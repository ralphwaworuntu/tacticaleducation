import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './errorHandler';
import { assertActiveMembership } from '../utils/membership';

export async function requireActiveMembership(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return next(new HttpError('Unauthorized', 401));
    }
    await assertActiveMembership(req.user.id);
    return next();
  } catch (error) {
    return next(error);
  }
}
