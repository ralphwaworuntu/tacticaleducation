import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { HttpError } from './errorHandler';
import { isPremiumUser } from '../utils/membership';

type JwtPayload = {
  sub: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  name: string;
  referralCode: string;
  isEmailVerified: boolean;
  sessionVersion: number;
};

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;

  if (!token) {
    return next(new HttpError('Unauthorized', 401));
  }

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
    const account = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { isActive: true, sessionVersion: true },
    });
    if (!account || !account.isActive) {
      return next(new HttpError('Akun Anda dinonaktifkan atau tidak ditemukan.', 403));
    }
    if (payload.sessionVersion !== account.sessionVersion) {
      const premium = await isPremiumUser(payload.sub);
      if (!premium) {
        return next(new HttpError('Sesi Anda telah berakhir karena login di perangkat lain.', 401));
      }
    }
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      name: payload.name,
      referralCode: payload.referralCode,
      isEmailVerified: payload.isEmailVerified,
    };
    return next();
  } catch (error) {
    return next(new HttpError('Invalid or expired token', 401));
  }
}

export function authorize(roles: Array<'ADMIN' | 'MEMBER'>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new HttpError('Forbidden', 403));
    }
    return next();
  };
}
